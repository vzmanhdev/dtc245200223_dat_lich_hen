$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskLog = Join-Path $taskRoot 'docs/wsl-install.log'
Start-Transcript -Path $taskLog -Append
try {
    winget install --id Microsoft.WSL --exact --source winget --accept-source-agreements --accept-package-agreements --silent --disable-interactivity
    if ($LASTEXITCODE -notin @(0, -1978335189)) { Write-Output "winget exit code: $LASTEXITCODE" }
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
    Write-Output "VirtualMachinePlatform exit code: $LASTEXITCODE"
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    Write-Output "WSL feature exit code: $LASTEXITCODE"
    wsl.exe --version
    Write-Output 'Setup finished. Restart Windows manually if required; this script never restarts the computer.'
} finally { Stop-Transcript }
