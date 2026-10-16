# Windows: запуск без Docker

1. Установи .NET SDK 10, Node.js 24 LTS и PostgreSQL (если их ещё нет). При установке PostgreSQL запомни пароль пользователя `postgres` и порт, обычно `5432`. Сам PostgreSQL должен быть запущен как служба Windows; pgAdmin — отдельный клиент, открывать его для работы сайта не обязательно.
2. Распакуй архив в обычную папку. Открой PowerShell в папке `tutor-space`, где лежит `start-local.ps1`.
3. Дважды нажми `start-local.cmd` или выполни в PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

Скрипт проверит .NET и Node, спросит адрес, порт, пользователя и пароль PostgreSQL, создаст локальную конфигурацию, установит frontend-зависимости и откроет два окна. Если у пользователя PostgreSQL есть право CREATE DATABASE, база `tutor_space` создастся автоматически. Пользователь `postgres`, созданный стандартным установщиком, обычно имеет это право.

После появления `Now listening on: http://localhost:8080` в окне backend и адреса Vite в окне frontend открой **http://localhost:5173**. Используй именно `localhost`, а не `127.0.0.1`: для входа настроен один Origin.

Email и сгенерированный пароль репетитора скрипт покажет при первой настройке. Они также находятся в `backend/appsettings.Local.json`. Эта конфигурация содержит секреты и исключена из Git и Docker-сборки. Не пересылай её и не добавляй в репозиторий.

При следующих запусках вводить параметры повторно не потребуется. Для остановки нажми Ctrl+C в обоих окнах. PostgreSQL продолжит работать как служба, данные останутся.

## Если нужно запускать вручную

Первичная настройка один раз:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-local.ps1
```

Затем в первом PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-api-local.ps1
```

Во втором PowerShell:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Backend: localhost:8080, frontend: localhost:5173. Vite проксирует API и WebSocket прямо в ASP.NET Core. Nginx, Docker и WSL не нужны.

## Если PostgreSQL не подключается

Проверь в Windows «Службы», что служба PostgreSQL запущена. Исправь порт и пароль в `backend/appsettings.Local.json`, затем перезапусти окно API. Если твой PostgreSQL работает на 5433, укажи 5433 при настройке. Для отдельной базы используй имя `tutor_space`, а не базу другого проекта. `EnsureCreated` рассчитан на новую, пустую базу.

Если нет права создать базу, создай её через pgAdmin от имени администратора PostgreSQL и назначь владельцем пользователя из конфигурации. Пароль PostgreSQL и пароль репетитора — разные пароли.

Если порт 8080 или 5173 занят, останови использующее его приложение. Vite намеренно не переключается на другой порт, чтобы не сломать проверку Origin.

## Файлы и обновления

Загруженные материалы и ключи входа сохраняются в `backend/App_Data`, записи — в PostgreSQL. Сохраняй `App_Data` и базу при обновлении исходников. Не удаляй конфигурацию после первого запуска: новый пароль в конфигурации не заменяет пароль уже существующей учётки в базе.

В локальном режиме `.env` из Docker-версии не читается. Для ботов заполняй `TELEGRAM_BOT_TOKEN` и `VK_BOT_TOKEN` в `backend/appsettings.Local.json` и перезапускай API.

Проверка версий:

```powershell
dotnet --list-sdks
node --version
psql --version
```

Отсутствие `psql` в PATH не обязательно означает отсутствие PostgreSQL: проверь установленную службу или pgAdmin.
