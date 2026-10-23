$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot/docker.ps1"
$taskDocker = Get-ProjectDocker
$taskBackupDir = Join-Path (Get-Location) 'backups'
New-Item -ItemType Directory -Path $taskBackupDir -Force | Out-Null
$taskStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$taskDumpPath = Join-Path $taskBackupDir "appointment-$taskStamp.dump"
& $taskDocker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/appointment-backup.dump'
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
& $taskDocker compose cp postgres:/tmp/appointment-backup.dump $taskDumpPath
if ($LASTEXITCODE -ne 0) { throw 'Dump copy failed.' }
& $taskDocker compose exec -T postgres rm -f /tmp/appointment-backup.dump
Get-FileHash -Algorithm SHA256 -LiteralPath $taskDumpPath | Format-List
Write-Output "Backup saved: $taskDumpPath. Verify with scripts/restore-test.ps1; a file alone is not proof of a valid backup."
