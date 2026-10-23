$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot/docker.ps1"
$taskDocker = Get-ProjectDocker
node scripts/setup-env.js
if ($LASTEXITCODE -ne 0) { throw 'Environment setup failed.' }
& $taskDocker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker Engine is not running. Open Docker Desktop, finish WSL setup and retry.' }
& $taskDocker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Compose config failed.' }
& $taskDocker compose up -d --build --wait --wait-timeout 240
if ($LASTEXITCODE -ne 0) { throw 'Startup did not pass readiness. Run docker compose logs --tail=100.' }
& $taskDocker compose ps
node scripts/smoke.js
if ($LASTEXITCODE -ne 0) { throw 'Web smoke failed.' }
Write-Output 'Website http://localhost:8080 | pgAdmin http://localhost:5050 | Grafana http://localhost:3001 | Prometheus http://localhost:9090'
Write-Output 'Read credentials in local .env. Do not share or commit .env.'
