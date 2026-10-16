$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$configPath = Join-Path $PSScriptRoot 'backend\appsettings.Local.json'
if (Test-Path $configPath) {
    Write-Host 'Локальная конфигурация уже существует. Она не изменена.'
    Write-Host 'Адрес сайта: http://localhost:5173'
    exit 0
}
function Read-Default([string]$Prompt, [string]$Default) {
    $value = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value.Trim()
}
function New-Secret {
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [Convert]::ToBase64String($bytes)
}
$dbHost = Read-Default 'Адрес PostgreSQL' 'localhost'
$dbPortText = Read-Default 'Порт PostgreSQL' '5432'
$dbPort = 0
if (-not [int]::TryParse($dbPortText, [ref]$dbPort) -or $dbPort -lt 1 -or $dbPort -gt 65535) {
    throw 'Неверный порт PostgreSQL.'
}
$dbName = Read-Default 'Имя новой базы' 'tutor_space'
$dbUser = Read-Default 'Пользователь PostgreSQL' 'postgres'
$dbSecret = Read-Host 'Пароль PostgreSQL, заданный при установке' -AsSecureString
$dbCredential = [System.Net.NetworkCredential]::new('', $dbSecret)
$dbPassword = $dbCredential.Password
$tutorEmail = Read-Default 'Твой email для входа в кабинет' 'ilona@example.ru'
$tutorPassword = New-Secret
function Quote-ConnectionValue([string]$Value) {
    return '"' + $Value.Replace('"', '""') + '"'
}
$connection = 'Host=' + (Quote-ConnectionValue $dbHost) + ';Port=' + $dbPort + ';Database=' + (Quote-ConnectionValue $dbName) + ';Username=' + (Quote-ConnectionValue $dbUser) + ';Password=' + (Quote-ConnectionValue $dbPassword)
$config = @{
    ConnectionStrings = @{ Default = $connection }
    TUTOR_EMAIL = $tutorEmail
    TUTOR_PASSWORD = $tutorPassword
    PUBLIC_ORIGIN = 'http://localhost:5173'
    DATA_DIRECTORY = 'App_Data'
    TELEGRAM_BOT_TOKEN = ''
    VK_BOT_TOKEN = ''
}
$json = $config | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ''
Write-Host 'Конфигурация создана: backend\appsettings.Local.json'
Write-Host "Вход: $tutorEmail"
Write-Host "Пароль репетитора: $tutorPassword"
Write-Host 'Сохрани пароль. Он также записан в локальной конфигурации.'
Write-Host 'База будет создана при первом запуске API, если у пользователя PostgreSQL есть право CREATE DATABASE.'
