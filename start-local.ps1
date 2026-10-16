$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
foreach ($command in @('dotnet', 'node', 'npm.cmd')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Не найден $command. Установи .NET SDK 10 и Node.js 24, затем открой новый PowerShell."
    }
}
$sdkList = dotnet --list-sdks
if (-not ($sdkList | Where-Object { $_ -match '^10\.' })) { throw 'Нужен .NET SDK 10.' }
$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 24) { throw 'Для этого запуска установи Node.js 24 или новее.' }
if (-not (Test-Path 'backend\appsettings.Local.json')) {
    & (Join-Path $PSScriptRoot 'setup-local.ps1')
}
Push-Location (Join-Path $PSScriptRoot 'frontend')
try {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось установить frontend-зависимости. Проверь подключение к npm.' }
} finally { Pop-Location }
$apiScript = Join-Path $PSScriptRoot 'run-api-local.ps1'
$webScript = Join-Path $PSScriptRoot 'run-web-local.ps1'
Start-Process powershell.exe -ArgumentList @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $apiScript + '"'))
Start-Process powershell.exe -ArgumentList @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $webScript + '"'))
Write-Host 'Запущены два окна: API и frontend. Дождись готовности в обоих.'
Write-Host 'Открой http://localhost:5173'
Write-Host 'Для остановки нажми Ctrl+C в обоих окнах.'
