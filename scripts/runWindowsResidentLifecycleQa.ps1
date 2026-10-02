param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [Parameter(Mandatory = $true)][string]$EvidenceRoot
)
$ErrorActionPreference = 'Stop'
$candidate = (Resolve-Path -LiteralPath $Executable).Path
$root = [System.IO.Path]::GetFullPath($EvidenceRoot)
if (Test-Path -LiteralPath $root) { throw 'Use a fresh regression evidence root.' }
New-Item -ItemType Directory -Path $root | Out-Null
foreach ($mode in @('background', 'visible_quit')) {
    $modeRoot = Join-Path $root $mode
    foreach ($directory in @('profile', 'appdata', 'localappdata', 'temp')) {
        New-Item -ItemType Directory -Path (Join-Path $modeRoot $directory) -Force | Out-Null
    }
    $env:ZC_NATIVE_QA_RESIDENT_LIFECYCLE = $mode
    $env:ZC_NATIVE_QA_PROFILE_ROOT = Join-Path $modeRoot 'profile'
    $env:APPDATA = Join-Path $modeRoot 'appdata'
    $env:LOCALAPPDATA = Join-Path $modeRoot 'localappdata'
    $env:TEMP = Join-Path $modeRoot 'temp'
    $env:TMP = $env:TEMP
    $stderr = Join-Path $modeRoot 'stderr.log'
    $process = Start-Process -FilePath $candidate -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $modeRoot 'stdout.log') -RedirectStandardError $stderr
    $process.Id | Set-Content -LiteralPath (Join-Path $modeRoot 'pid.txt')
    if (!$process.WaitForExit(120000)) {
        # Only the child launched by this regression; preserve all evidence.
        $process.Kill()
        throw "Resident regression deadline exceeded: $mode"
    }
    $process.WaitForExit()
    $trace = Get-Content -LiteralPath $stderr -Raw
    Write-Output $trace
    if ($process.ExitCode -ne 0 -or $trace -notmatch 'resident_regression PASS' -or $trace -match 'resident_regression FAIL') {
        throw "Resident regression failed: $mode; exit=$($process.ExitCode)"
    }
    if ($mode -eq 'background' -and ($trace -notmatch 'background_delivery_verified' -or $trace -notmatch 'reopen_verified')) {
        throw 'Background delivery/reopen proof missing.'
    }
}
Get-FileHash -LiteralPath $candidate -Algorithm SHA256 | Format-List
