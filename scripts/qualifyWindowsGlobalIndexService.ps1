param(
    [Parameter(Mandatory = $true)][string]$CandidateExe,
    [Parameter(Mandatory = $true)][string]$ProbeExe,
    [Parameter(Mandatory = $true)][string]$EvidencePath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$serviceName = "ZenCanvasGlobalIndex"
$runnerTemp = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\') + '\'
$taskId = "zb05-global-index-service-$env:GITHUB_RUN_ID-$env:GITHUB_RUN_ATTEMPT"
$taskRoot = [IO.Path]::GetFullPath((Join-Path $runnerTemp $taskId))
$profileRoot = Join-Path $taskRoot "profile"
$fixtureRoot = Join-Path $taskRoot "fixtures"
$tracePath = Join-Path $taskRoot "global-index-trace.log"
$CandidateExe = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $CandidateExe).Path)
$ProbeExe = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $ProbeExe).Path)
$EvidencePath = [IO.Path]::GetFullPath($EvidencePath)

if (-not $taskRoot.StartsWith($runnerTemp, [StringComparison]::OrdinalIgnoreCase)) {
    throw "refusing to create qualification data outside RUNNER_TEMP: $taskRoot"
}
if (-not $CandidateExe.StartsWith([IO.Path]::GetFullPath($PWD.Path), [StringComparison]::OrdinalIgnoreCase)) {
    throw "candidate executable must be inside the exact checked-out source workspace: $CandidateExe"
}

$script:evidence = [ordered]@{
    sourceHead = $null
    expectedSourceHead = $env:EXPECTED_SOURCE_SHA
    candidateExe = $CandidateExe
    candidateSha256 = $null
    runner = $null
    serviceName = $serviceName
    serviceImagePath = $null
    serviceCurrentExe = $null
    clientCurrentExe = $null
    sameImage = $false
    fixedNtfsSource = $null
    provider = $null
    sourceStatus = $null
    sourceLastError = $null
    baselineEntryCount = $null
    baselineFixturePath = $null
    baselineFixtureSearchFound = $false
    createLatencyMs = $null
    renameLatencyMs = $null
    deleteLatencyMs = $null
    settledIdleWindowMs = 10000
    settledCoordinatorCycleDelta = $null
    settledCoordinatorWaitDelta = $null
    serviceRouteObserved = $false
    serviceControl = @()
    failure = $null
    cleanup = [ordered]@{
        serviceStopped = $false
        serviceDeleted = $false
        candidateProcessesTerminated = $false
        taskProfileRemoved = $false
        details = @()
    }
}

$script:probeProcess = $null
$script:clientProcessId = $null
$script:serviceProcessId = $null
$script:serviceCreatedByTask = $false
$script:failureMessage = $null
$script:cleanupFailure = $false

function Invoke-ServiceControl([string[]]$Arguments) {
    $output = (& sc.exe @Arguments 2>&1 | Out-String).Trim()
    $exitCode = $LASTEXITCODE
    $script:evidence.serviceControl += [ordered]@{
        arguments = @($Arguments)
        exitCode = $exitCode
        output = $output
    }
    return [pscustomobject]@{ ExitCode = $exitCode; Output = $output }
}

function Get-TraceLines {
    if (Test-Path -LiteralPath $tracePath) {
        return @(Get-Content -LiteralPath $tracePath -ErrorAction SilentlyContinue)
    }
    return @()
}

function Get-TraceCounts {
    $lines = Get-TraceLines
    return [pscustomobject]@{
        Lines = $lines
        Cycles = @($lines | Where-Object { $_ -ceq "coordinator_cycle" }).Count
        Waits = @($lines | Where-Object { $_ -ceq "coordinator_wait" }).Count
        ServiceRoutes = @($lines | Where-Object { $_ -ceq "windows_service_route_ok" }).Count
    }
}

function Start-QualificationProbe {
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $ProbeExe
    $startInfo.WorkingDirectory = (Get-Location).Path
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    $startInfo.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw "failed to start QA probe: $ProbeExe" }
    $process.BeginErrorReadLine()
    $script:probeProcess = $process
}

function Get-ProbeSnapshot([string]$Query = "") {
    if ($null -eq $script:probeProcess -or $script:probeProcess.HasExited) {
        $exitCode = if ($null -eq $script:probeProcess) { "not-started" } else { $script:probeProcess.ExitCode }
        throw "read-only Global Index QA probe is not running (exit=$exitCode)"
    }
    $request = @{ query = $Query } | ConvertTo-Json -Compress
    $script:probeProcess.StandardInput.WriteLine($request)
    $script:probeProcess.StandardInput.Flush()
    $responseTask = $script:probeProcess.StandardOutput.ReadLineAsync()
    if (-not $responseTask.Wait([TimeSpan]::FromSeconds(15))) {
        throw "Global Index QA probe did not respond within 15 seconds"
    }
    $line = $responseTask.Result
    if ([string]::IsNullOrWhiteSpace($line)) {
        throw "Global Index QA probe returned no response"
    }
    return $line | ConvertFrom-Json
}

function Test-SearchPath([string]$Query, [string]$Path) {
    $snapshot = Get-ProbeSnapshot $Query
    return @($snapshot.results | Where-Object {
        $_.path.Equals($Path, [StringComparison]::OrdinalIgnoreCase)
    }).Count -gt 0
}

function Wait-ForSearchPath([string]$Query, [string]$Path, [bool]$Present, [int]$TimeoutSeconds, [string]$Label, [Diagnostics.Stopwatch]$Timer = $null) {
    $timer = if ($null -eq $Timer) { [Diagnostics.Stopwatch]::StartNew() } else { $Timer }
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $found = Test-SearchPath $Query $Path
        if ($found -eq $Present) {
            $timer.Stop()
            return [long]$timer.Elapsed.TotalMilliseconds
        }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "$Label did not reach expected search state within $TimeoutSeconds seconds (expectedPresent=$Present path=$Path)"
}

function Get-ProcessImage([int]$ProcessId) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
    if ($null -eq $process -or [string]::IsNullOrWhiteSpace($process.ExecutablePath)) {
        throw "cannot read ExecutablePath for process $ProcessId"
    }
    return [IO.Path]::GetFullPath($process.ExecutablePath)
}

function Stop-Probe {
    if ($null -eq $script:probeProcess) { return }
    try {
        if (-not $script:probeProcess.HasExited) {
            $script:probeProcess.StandardInput.Close()
            if (-not $script:probeProcess.WaitForExit(5000)) {
                $script:probeProcess.Kill($true)
                $script:probeProcess.WaitForExit(5000)
            }
        }
        $script:evidence.cleanup.details += "QA probe stopped"
    } catch {
        $script:cleanupFailure = $true
        $script:evidence.cleanup.details += "QA probe cleanup failed: $($_.Exception.Message)"
    }
}

try {
    $sourceHead = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw "git rev-parse HEAD failed with exit code $LASTEXITCODE" }
    $script:evidence.sourceHead = $sourceHead
    if ($sourceHead -cne $env:EXPECTED_SOURCE_SHA) {
        throw "source HEAD mismatch: expected=$env:EXPECTED_SOURCE_SHA actual=$sourceHead"
    }
    $os = Get-CimInstance Win32_OperatingSystem
    $script:evidence.runner = [ordered]@{
        caption = $os.Caption
        version = $os.Version
        build = $os.BuildNumber
        architecture = $os.OSArchitecture
        runId = $env:GITHUB_RUN_ID
        runAttempt = $env:GITHUB_RUN_ATTEMPT
    }
    $script:evidence.candidateSha256 = (Get-FileHash -LiteralPath $CandidateExe -Algorithm SHA256).Hash

    New-Item -ItemType Directory -Path $profileRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null
    $preexistingToken = "zb05qapreexisting$([Guid]::NewGuid().ToString('N'))"
    $preexistingPath = Join-Path $fixtureRoot "$preexistingToken.txt"
    New-Item -ItemType File -Path $preexistingPath | Out-Null
    Set-Content -LiteralPath $preexistingPath -Value "created before the Global Index baseline" -NoNewline
    $script:evidence.baselineFixturePath = $preexistingPath

    $driveLetter = [IO.Path]::GetPathRoot($fixtureRoot).Substring(0, 1)
    $logicalDisk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$driveLetter`:'"
    if ($null -eq $logicalDisk -or $logicalDisk.FileSystem -ine "NTFS" -or $logicalDisk.DriveType -ne 3) {
        throw "qualification fixture must be on a fixed NTFS volume; drive=$driveLetter filesystem=$($logicalDisk.FileSystem) driveType=$($logicalDisk.DriveType)"
    }

    $env:ZC_NATIVE_QA_PROFILE_ROOT = $profileRoot
    $env:ZC_GLOBAL_INDEX_QA_TRACE = $tracePath
    $env:APPDATA = Join-Path $taskRoot "appdata-roaming"
    $env:LOCALAPPDATA = Join-Path $taskRoot "appdata-local"
    $env:TEMP = Join-Path $taskRoot "temp"
    $env:TMP = $env:TEMP
    New-Item -ItemType Directory -Path $env:APPDATA -Force | Out-Null
    New-Item -ItemType Directory -Path $env:LOCALAPPDATA -Force | Out-Null
    New-Item -ItemType Directory -Path $env:TEMP -Force | Out-Null

    $serviceImagePath = '"' + $CandidateExe + '" --index-service'
    $preexistingService = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
    if ($preexistingService) {
        throw "refusing to replace or manage a pre-existing $serviceName service: $($preexistingService.PathName)"
    }
    $create = Invoke-ServiceControl @("create", $serviceName, "binPath=", $serviceImagePath, "start=", "demand", "obj=", "LocalSystem")
    if ($create.ExitCode -ne 0) {
        throw "CreateService failed; exact SCM output (exit=$($create.ExitCode)): $($create.Output)"
    }
    $script:serviceCreatedByTask = $true
    Set-Content -LiteralPath (Join-Path $taskRoot "service-created-by-qualification.txt") -Value $CandidateExe -NoNewline

    $start = Invoke-ServiceControl @("start", $serviceName)
    if ($start.ExitCode -ne 0) {
        $failedService = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
        $status = if ($failedService) { "state=$($failedService.State) win32ExitCode=$($failedService.ExitCode) serviceSpecificExitCode=$($failedService.ServiceSpecificExitCode)" } else { "service record unavailable" }
        throw "StartService failed; exact SCM output (exit=$($start.ExitCode)); $status; output=$($start.Output)"
    }

    $serviceDeadline = [DateTime]::UtcNow.AddSeconds(45)
    $service = $null
    do {
        $service = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
        if ($service -and $service.State -eq "Running") { break }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $serviceDeadline)
    if (-not $service -or $service.State -ne "Running") {
        $state = if ($service) { "state=$($service.State) win32ExitCode=$($service.ExitCode) serviceSpecificExitCode=$($service.ServiceSpecificExitCode)" } else { "service record unavailable" }
        throw "service did not reach Running within 45 seconds; $state"
    }
    $script:serviceProcessId = [int]$service.ProcessId
    $script:evidence.serviceImagePath = $service.PathName
    $expectedServiceImagePath = ('"' + $CandidateExe + '" --index-service')
    if ($service.PathName.Trim() -ine $expectedServiceImagePath) {
        throw "service ImagePath mismatch: expected=$expectedServiceImagePath actual=$($service.PathName)"
    }
    $serviceCurrentExe = Get-ProcessImage $script:serviceProcessId
    $script:evidence.serviceCurrentExe = $serviceCurrentExe
    if (-not $serviceCurrentExe.Equals($CandidateExe, [StringComparison]::OrdinalIgnoreCase)) {
        throw "service current_exe mismatch: candidate=$CandidateExe service=$serviceCurrentExe"
    }

    $client = Start-Process -FilePath $CandidateExe -ArgumentList @("--background") -WorkingDirectory (Get-Location).Path -PassThru
    $script:clientProcessId = $client.Id
    $clientCurrentExe = Get-ProcessImage $script:clientProcessId
    $script:evidence.clientCurrentExe = $clientCurrentExe
    if (-not $clientCurrentExe.Equals($CandidateExe, [StringComparison]::OrdinalIgnoreCase)) {
        throw "client image mismatch: candidate=$CandidateExe client=$clientCurrentExe"
    }
    $script:evidence.sameImage = $serviceCurrentExe.Equals($clientCurrentExe, [StringComparison]::OrdinalIgnoreCase)
    if (-not $script:evidence.sameImage) {
        throw "service/client physical image mismatch: service=$serviceCurrentExe client=$clientCurrentExe"
    }

    $coordinatorDeadline = [DateTime]::UtcNow.AddSeconds(90)
    do {
        if ($client.HasExited) { throw "background client exited during startup with code $($client.ExitCode)" }
        $trace = Get-TraceLines
        if ($trace -contains "coordinator_cycle") { break }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $coordinatorDeadline)
    if ($trace -notcontains "coordinator_cycle") {
        throw "candidate coordinator did not start; no coordinator_cycle trace was recorded"
    }

    Start-QualificationProbe
    $baselineDeadline = [DateTime]::UtcNow.AddMinutes(15)
    $baselineSource = $null
    $baselineSnapshot = $null
    do {
        if ($client.HasExited) { throw "background client exited before baseline completion with code $($client.ExitCode)" }
        $baselineSnapshot = Get-ProbeSnapshot $preexistingToken
        $eligibleSources = @($baselineSnapshot.volumes | Where-Object {
            $_.enabled -and $_.filesystemType -ieq "NTFS" -and $_.driveKind -ieq "fixed" -and $_.provider -ceq "windows_mft_usn" -and $preexistingPath.StartsWith($_.mountPath, [StringComparison]::OrdinalIgnoreCase)
        })
        if ($eligibleSources.Count -gt 0) {
            $baselineSource = $eligibleSources | Sort-Object { $_.mountPath.Length } -Descending | Select-Object -First 1
            if ($baselineSource.status -in @("rebuild_required", "permission_required", "error", "unavailable")) {
                throw "fixed NTFS baseline did not complete truthfully: status=$($baselineSource.status) error=$($baselineSource.lastError) entry_count=$($baselineSource.entryCount)"
            }
            if ($baselineSource.status -eq "ready" -and $null -ne $baselineSource.lastFullIndexAt) { break }
        }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $baselineDeadline)
    if ($null -eq $baselineSource -or $baselineSource.status -ne "ready" -or $null -eq $baselineSource.lastFullIndexAt) {
        $status = if ($baselineSource) { "status=$($baselineSource.status) error=$($baselineSource.lastError) entry_count=$($baselineSource.entryCount)" } else { "enabled fixed NTFS source was not discovered" }
        throw "native MFT baseline did not become ready within 15 minutes: $status"
    }
    if ([long]$baselineSource.entryCount -le 0) {
        throw "native MFT baseline is incomplete: fixed NTFS source reached ready with entry_count=$($baselineSource.entryCount)"
    }
    $script:evidence.fixedNtfsSource = $baselineSource.id
    $script:evidence.provider = $baselineSource.provider
    $script:evidence.sourceStatus = $baselineSource.status
    $script:evidence.sourceLastError = $baselineSource.lastError
    $script:evidence.baselineEntryCount = [long]$baselineSource.entryCount
    $baselineTrace = Get-TraceCounts
    $script:evidence.serviceRouteObserved = $baselineTrace.ServiceRoutes -gt 0
    if (-not $script:evidence.serviceRouteObserved) {
        throw "fixed NTFS baseline completed without a successful service-stream request"
    }
    $script:evidence.baselineFixtureSearchFound = @($baselineSnapshot.results | Where-Object {
        $_.path.Equals($preexistingPath, [StringComparison]::OrdinalIgnoreCase)
    }).Count -gt 0
    if (-not $script:evidence.baselineFixtureSearchFound) {
        throw "pre-existing baseline fixture was not searchable after a non-empty ready baseline: $preexistingPath"
    }

    $freshnessToken = "zb05qafresh$([Guid]::NewGuid().ToString('N'))"
    $createdName = "$freshnessToken-created.txt"
    $renamedName = "$freshnessToken-renamed.txt"
    $createdPath = Join-Path $fixtureRoot $createdName
    $renamedPath = Join-Path $fixtureRoot $renamedName
    $createTimer = [Diagnostics.Stopwatch]::StartNew()
    New-Item -ItemType File -Path $createdPath | Out-Null
    Set-Content -LiteralPath $createdPath -Value "created after the validated baseline" -NoNewline
    $script:evidence.createLatencyMs = Wait-ForSearchPath $createdName $createdPath $true 60 "create freshness" $createTimer

    $renameTimer = [Diagnostics.Stopwatch]::StartNew()
    Move-Item -LiteralPath $createdPath -Destination $renamedPath
    $renameDeadline = [DateTime]::UtcNow.AddSeconds(60)
    do {
        $newFound = Test-SearchPath $renamedName $renamedPath
        $oldFound = Test-SearchPath $createdName $createdPath
        if ($newFound -and -not $oldFound) {
            $renameTimer.Stop()
            $script:evidence.renameLatencyMs = [long]$renameTimer.Elapsed.TotalMilliseconds
            break
        }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $renameDeadline)
    if ($null -eq $script:evidence.renameLatencyMs) {
        throw "rename freshness did not converge within 60 seconds (newFound=$newFound oldFound=$oldFound)"
    }

    $deleteTimer = [Diagnostics.Stopwatch]::StartNew()
    Remove-Item -LiteralPath $renamedPath -Force
    $script:evidence.deleteLatencyMs = Wait-ForSearchPath $renamedName $renamedPath $false 60 "delete freshness" $deleteTimer

    $settleDeadline = [DateTime]::UtcNow.AddSeconds(30)
    $settleSince = $null
    $lastCycles = -1
    $lastWaits = -1
    do {
        $counts = Get-TraceCounts
        if ($counts.Lines.Count -gt 0 -and $counts.Lines[-1] -ceq "coordinator_wait" -and $counts.Cycles -eq $lastCycles -and $counts.Waits -eq $lastWaits) {
            if ($null -eq $settleSince) { $settleSince = [DateTime]::UtcNow }
            if (([DateTime]::UtcNow - $settleSince).TotalSeconds -ge 2) { break }
        } else {
            $settleSince = $null
            $lastCycles = $counts.Cycles
            $lastWaits = $counts.Waits
        }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $settleDeadline)
    if ($null -eq $settleSince) { throw "coordinator did not settle into its blocking idle wait" }
    $idleBefore = Get-TraceCounts
    $script:evidence.serviceRouteObserved = $idleBefore.ServiceRoutes -gt 0
    if (-not $script:evidence.serviceRouteObserved) { throw "no successful desktop-to-Windows-Service request was traced" }
    Start-Sleep -Milliseconds 10000
    $idleAfter = Get-TraceCounts
    $script:evidence.settledCoordinatorCycleDelta = $idleAfter.Cycles - $idleBefore.Cycles
    $script:evidence.settledCoordinatorWaitDelta = $idleAfter.Waits - $idleBefore.Waits
    if ($script:evidence.settledCoordinatorCycleDelta -ne 0 -or $script:evidence.settledCoordinatorWaitDelta -ne 0) {
        throw "settled idle was not quiet: cycleDelta=$($script:evidence.settledCoordinatorCycleDelta) waitDelta=$($script:evidence.settledCoordinatorWaitDelta)"
    }
} catch {
    $script:failureMessage = $_.Exception.ToString()
    $script:evidence.failure = $script:failureMessage
} finally {
    Stop-Probe

    try {
        $service = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
        if ($service -and $script:serviceCreatedByTask -and $service.PathName.Trim() -ieq ('"' + $CandidateExe + '" --index-service') -and $service.State -ne "Stopped") {
            $stop = Invoke-ServiceControl @("stop", $serviceName)
            $stopDeadline = [DateTime]::UtcNow.AddSeconds(25)
            do {
                Start-Sleep -Milliseconds 250
                $service = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
            } while ($service -and $service.State -ne "Stopped" -and [DateTime]::UtcNow -lt $stopDeadline)
            if ($service -and $service.State -ne "Stopped") {
                $script:cleanupFailure = $true
                $script:evidence.cleanup.details += "service stop timeout: scExit=$($stop.ExitCode) output=$($stop.Output)"
            } else {
                $script:evidence.cleanup.serviceStopped = $true
            }
        } elseif (-not $service) {
            $script:evidence.cleanup.serviceStopped = $true
        } elseif ($script:serviceCreatedByTask -and $service.PathName.Trim() -ieq ('"' + $CandidateExe + '" --index-service')) {
            $script:evidence.cleanup.serviceStopped = $true
        } else {
            $script:evidence.cleanup.details += "left pre-existing or non-matching service untouched: $($service.PathName)"
        }

        if ($null -ne $script:clientProcessId) {
            $clientImage = $null
            try { $clientImage = Get-ProcessImage ([int]$script:clientProcessId) } catch {}
            if ($clientImage -and $clientImage.Equals($CandidateExe, [StringComparison]::OrdinalIgnoreCase)) {
                Stop-Process -Id $script:clientProcessId -Force -ErrorAction SilentlyContinue
            }
        }
        if ($null -ne $script:serviceProcessId) {
            $serviceImage = $null
            try { $serviceImage = Get-ProcessImage ([int]$script:serviceProcessId) } catch {}
            if ($serviceImage -and $serviceImage.Equals($CandidateExe, [StringComparison]::OrdinalIgnoreCase)) {
                Stop-Process -Id $script:serviceProcessId -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Milliseconds 500
        $remainingCandidateProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath).Equals($CandidateExe, [StringComparison]::OrdinalIgnoreCase)
        })
        $script:evidence.cleanup.candidateProcessesTerminated = $remainingCandidateProcesses.Count -eq 0
        if (-not $script:evidence.cleanup.candidateProcessesTerminated) {
            $script:cleanupFailure = $true
            $script:evidence.cleanup.details += "candidate process remains: $($remainingCandidateProcesses.ProcessId -join ',')"
        }

        $service = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
        if (-not $service) {
            $script:evidence.cleanup.serviceDeleted = $true
        } elseif ($script:serviceCreatedByTask -and $service.PathName.Trim() -ieq ('"' + $CandidateExe + '" --index-service')) {
            $delete = Invoke-ServiceControl @("delete", $serviceName)
            $deleteDeadline = [DateTime]::UtcNow.AddSeconds(10)
            do {
                $serviceAfterDelete = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
                if (-not $serviceAfterDelete) { break }
                Start-Sleep -Milliseconds 250
            } while ([DateTime]::UtcNow -lt $deleteDeadline)
            $script:evidence.cleanup.serviceDeleted = $null -eq $serviceAfterDelete
            if (-not $script:evidence.cleanup.serviceDeleted) {
                $script:cleanupFailure = $true
                $script:evidence.cleanup.details += "service still registered after delete: scExit=$($delete.ExitCode) output=$($delete.Output)"
            }
        } else {
            $script:evidence.cleanup.serviceDeleted = $false
        }

        if (Test-Path -LiteralPath $taskRoot) {
            if (-not $taskRoot.StartsWith($runnerTemp, [StringComparison]::OrdinalIgnoreCase)) {
                throw "refusing cleanup outside RUNNER_TEMP: $taskRoot"
            }
            Remove-Item -LiteralPath $taskRoot -Recurse -Force
        }
        $script:evidence.cleanup.taskProfileRemoved = -not (Test-Path -LiteralPath $taskRoot)
        if (-not $script:evidence.cleanup.taskProfileRemoved) {
            $script:cleanupFailure = $true
            $script:evidence.cleanup.details += "task profile remains: $taskRoot"
        }
    } catch {
        $script:cleanupFailure = $true
        $script:evidence.cleanup.details += "cleanup exception: $($_.Exception.ToString())"
    }

    $evidenceDirectory = Split-Path -Parent $EvidencePath
    New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null
    $script:evidence | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $EvidencePath -Encoding utf8NoBOM
}

if ($script:failureMessage) {
    Write-Error $script:failureMessage
    exit 1
}
if ($script:cleanupFailure) {
    Write-Error "disposable Windows qualification cleanup did not fully complete"
    exit 1
}
Write-Output "Windows Global Index service qualification passed; evidence: $EvidencePath"
