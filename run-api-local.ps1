$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path 'backend\appsettings.Local.json')) { throw 'Сначала выполни setup-local.ps1.' }
Set-Location (Join-Path $PSScriptRoot 'backend')
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:DOTNET_ENVIRONMENT = 'Development'
dotnet run --project (Join-Path $PSScriptRoot 'backend\TutorSpace.csproj') --no-launch-profile --urls http://localhost:8080
if ($LASTEXITCODE -ne 0) { throw 'Backend не запустился. Проверь сообщение выше и параметры PostgreSQL.' }
