# Зависимости

Backend:

- .NET / ASP.NET Core 10.
- Npgsql.EntityFrameworkCore.PostgreSQL 10.0.3, включая транзитивные EF Core и Npgsql.
- Cookie Authentication, PasswordHasher, SignalR и HttpClient входят в ASP.NET Core shared framework.

Frontend:

- React / React DOM 19.2.6.
- TypeScript 5.9.3.
- Vite 8.0.13 и @vitejs/plugin-react 6.0.2.
- KaTeX 0.16.22.
- @microsoft/signalr 10.0.0.
- lucide-react 1.31.0.

Docker: PostgreSQL 17 Alpine, Node.js 24 Alpine для сборки, Nginx 1.28 Alpine, .NET SDK / ASP.NET runtime 10.0.

Frontend фиксируется через package-lock.json и npm ci. NuGet-пакет указан точной версией в csproj. Runtime-образы используют теги веток; для воспроизводимого production-деплоя их можно зафиксировать digest после проверки на своём сервере.

Источники: https://www.nuget.org/packages/Npgsql.EntityFrameworkCore.PostgreSQL/10.0.3, https://learn.microsoft.com/aspnet/core/, https://katex.org/docs/options, https://core.telegram.org/bots/api, https://dev.vk.com/ru/method/messages.send.
