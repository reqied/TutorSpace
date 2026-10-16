FROM node:24-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS backend
WORKDIR /src
COPY backend/TutorSpace.csproj ./
RUN dotnet restore
COPY backend/ ./
RUN dotnet publish -c Release -o /app --no-restore
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS api
WORKDIR /app
COPY --from=backend /app ./
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet","TutorSpace.dll"]
FROM nginx:1.28-alpine AS web
COPY --from=frontend /src/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
