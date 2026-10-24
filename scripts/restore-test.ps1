param([Parameter(Mandatory=$true)][string]$BackupFile)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot/docker.ps1"
$taskDocker = Get-ProjectDocker
$taskSource = (Resolve-Path -LiteralPath $BackupFile).Path
if (-not $taskSource.EndsWith('.dump')) { throw 'Expected a PostgreSQL custom .dump file.' }
$taskRestoreDb = 'restore_verify_' + (Get-Date -Format 'yyyyMMddHHmmss')
& $taskDocker compose cp $taskSource postgres:/tmp/restore-verify.dump
if ($LASTEXITCODE -ne 0) { throw 'Copy failed.' }
& $taskDocker compose exec -T postgres sh -c "createdb -U postgres $taskRestoreDb"
if ($LASTEXITCODE -ne 0) { throw 'Creating verification database failed.' }
& $taskDocker compose exec -T postgres sh -c "pg_restore -U postgres -d $taskRestoreDb --exit-on-error /tmp/restore-verify.dump"
if ($LASTEXITCODE -ne 0) { throw 'Restore failed. Source database was not modified.' }
& $taskDocker compose exec -T postgres psql -U postgres -d $taskRestoreDb -c 'SELECT count(*) AS appointments FROM appointments; SELECT version FROM schema_migrations;'
if ($LASTEXITCODE -ne 0) { throw 'Restored database validation failed.' }
Write-Output "Restore succeeded into separate database $taskRestoreDb. Original database was not overwritten. Verification database retained for inspection."
