$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$destination = Join-Path $PSScriptRoot ('backups\' + $stamp)
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$dbContainer = (docker compose ps -q db | Out-String).Trim()
$apiContainer = (docker compose ps -aq api | Out-String).Trim()
if (-not $dbContainer -or -not $apiContainer) { throw 'Контейнеры db и api не найдены. Запусти скрипт из папки рабочего проекта.' }
$dump = '/tmp/tutor-backup-' + $stamp + '.dump'
docker compose stop api web
if ($LASTEXITCODE -ne 0) { throw 'Не удалось остановить API и web для согласованной копии.' }
try {
    docker compose exec -T db pg_dump -U tutor -d tutor_space -Fc -f $dump
    if ($LASTEXITCODE -ne 0) { throw 'Ошибка резервного копирования PostgreSQL.' }
    docker cp ($dbContainer + ':' + $dump) (Join-Path $destination 'database.dump')
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось скопировать дамп базы.' }
    docker cp ($apiContainer + ':/data') (Join-Path $destination 'app-data')
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось скопировать материалы и ключи.' }
    if (Test-Path '.env') { Copy-Item '.env' (Join-Path $destination '.env') }
    docker compose exec -T db rm -f $dump
    Write-Host "Копия сохранена: $destination"
} finally {
    docker compose start api web
}
