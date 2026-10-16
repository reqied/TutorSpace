#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if [ -e .env ]; then
  echo '.env уже существует. Измените его вручную.'
  exit 1
fi
umask 077
tutor_password=$(openssl rand -hex 24)
database_password=$(openssl rand -hex 24)
sed -e "s/^TUTOR_PASSWORD=.*/TUTOR_PASSWORD=$tutor_password/" -e "s/^DB_PASSWORD=.*/DB_PASSWORD=$database_password/" .env.example > .env
echo '.env создан. Задайте TUTOR_EMAIL; пароль находится в TUTOR_PASSWORD.'
