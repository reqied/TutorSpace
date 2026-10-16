$ErrorActionPreference = 'Stop'
if (Test-Path .env) { throw '.env уже существует. Измените его вручную.' }
function New-Secret {
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [Convert]::ToBase64String($bytes)
}
$content = Get-Content .env.example -Raw
$content = $content.Replace('TUTOR_PASSWORD=', 'TUTOR_PASSWORD=' + (New-Secret)).Replace('DB_PASSWORD=', 'DB_PASSWORD=' + (New-Secret))
[System.IO.File]::WriteAllText((Join-Path $PWD '.env'), $content)
Write-Output '.env создан. Задайте TUTOR_EMAIL; пароль находится в TUTOR_PASSWORD.'
