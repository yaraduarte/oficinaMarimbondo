#!/bin/sh
# Aguarda o PostgreSQL ficar disponível antes de iniciar a aplicação

set -e

HOST="${DB_HOST:-localhost}"
PORT="${DB_PORT:-5432}"
USER="${DB_USER:-postgres}"

echo "Aguardando PostgreSQL em $HOST:$PORT..."

until pg_isready -h "$HOST" -p "$PORT" -U "$USER" > /dev/null 2>&1; do
  echo "PostgreSQL não está pronto ainda — aguardando 2 segundos..."
  sleep 2
done

echo "PostgreSQL está pronto! Iniciando aplicação..."
exec "$@"
