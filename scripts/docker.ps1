function Get-ProjectDocker {
    $available = Get-Command docker.exe -ErrorAction SilentlyContinue
    if ($available) { return $available.Source }
    $paths = @((Join-Path $env:USERPROFILE 'AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'), 'C:\Program Files\Docker\Docker\resources\bin\docker.exe')
    foreach ($candidate in $paths) { if (Test-Path -LiteralPath $candidate) { return $candidate } }
    throw 'Docker CLI not found. Install Docker Desktop with Linux containers.'
}
