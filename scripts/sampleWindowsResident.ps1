# Observer only: do not trim the candidate working set or change its priority.
if (-not ('ResidentWindowDiagnostics' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ResidentWindowDiagnostics {
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    public static extern int GetClassName(IntPtr handle, StringBuilder text, int maximum);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr handle, StringBuilder text, int maximum);
}
'@
}
function Get-ResidentProcessSample([int]$ProcessId, [string]$ExpectedImage) {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    $process.Refresh()
    $image = Get-ProcessImage $ProcessId
    if (-not $image.Equals($ExpectedImage, [StringComparison]::OrdinalIgnoreCase)) { throw "resident sample image mismatch: $image" }
    $children = @(Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId })
    $webviews = @($children | Where-Object { $_.Name -ieq 'msedgewebview2.exe' })
    $windowClass = [Text.StringBuilder]::new(256)
    $windowTitle = [Text.StringBuilder]::new(256)
    if ($process.MainWindowHandle.ToInt64() -ne 0) {
        [void][ResidentWindowDiagnostics]::GetClassName($process.MainWindowHandle, $windowClass, 256)
        [void][ResidentWindowDiagnostics]::GetWindowText($process.MainWindowHandle, $windowTitle, 256)
    }
    return [ordered]@{
        timestamp = [DateTime]::UtcNow.ToString('o')
        pid = $ProcessId
        image = $image
        lifetimeSeconds = ([DateTime]::Now - $process.StartTime).TotalSeconds
        workingSetBytes = $process.WorkingSet64
        privateCommittedBytes = $process.PrivateMemorySize64
        handles = $process.HandleCount
        cpuTotalSeconds = $process.TotalProcessorTime.TotalSeconds
        webviewChildren = $webviews.Count
        mainWindowHandle = $process.MainWindowHandle.ToInt64()
        nativeWindowClass = $windowClass.ToString()
        nativeWindowTitle = $windowTitle.ToString()
    }
}

function Assert-ResidentTrend($Samples) {
    # A strict increase in every settled interval is a review/block signal,
    # not a new absolute memory limit. Preserve every sample for diagnosis.
    foreach ($field in @('privateCommittedBytes', 'handles')) {
        $monotonic = $true
        for ($index = 1; $index -lt $Samples.Count; $index++) {
            if ($Samples[$index][$field] -le $Samples[$index - 1][$field]) { $monotonic = $false }
        }
        if ($monotonic) { throw "resident monotonic growth requires diagnosis: $field" }
    }
    for ($index = 0; $index -lt $Samples.Count; $index++) {
        $Samples[$index]['cpuDeltaSeconds'] = if ($index -eq 0) { 0 } else { $Samples[$index].cpuTotalSeconds - $Samples[$index - 1].cpuTotalSeconds }
    }
}
