# Проверка API

Тест создаёт двух учеников, материал, назначение, занятие, файл и рисунок. Запускай на отдельной тестовой базе, не на рабочем кабинете. После теста тестовую базу можно удалить.

Требуется Node.js 24 и зависимости frontend: `npm ci --prefix frontend`. Сервер должен быть запущен и иметь учётку репетитора.

PowerShell:

```powershell
$env:TEST_URL="http://localhost:8080"
$env:TUTOR_EMAIL="your-test-tutor@example.ru"
$env:TUTOR_PASSWORD="your-test-password"
node tests/integration.mjs
```

Linux:

```bash
TEST_URL=http://localhost:8080 TUTOR_EMAIL=your-test-tutor@example.ru TUTOR_PASSWORD=your-test-password node tests/integration.mjs
```

Проверяются вход, запреты ролей, изоляция учеников, скрытие правильного ответа, автопроверка, ручная проверка, статусы занятий, доступ к файлам, запись доски, конфликт версий, получение обновлений SignalR, запрет подключения к чужой доске и запрет чужого Origin. Отправка в Telegram/VK и браузерное взаимодействие в этот тест не входят.

Новые сценарии: `node tests/learning-v2.mjs` с теми же переменными окружения. Проверяют задачи внутри материала, приватность решений и карточки. Тест форматирования: `npm exec --yes --package=tsx -- tsx --tsconfig frontend/tsconfig.json tests/content-render.tsx`.
