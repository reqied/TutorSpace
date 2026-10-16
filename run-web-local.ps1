$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot 'frontend')
npm.cmd run dev
if ($LASTEXITCODE -ne 0) { throw 'Frontend не запустился. Проверь сообщение выше.' }
