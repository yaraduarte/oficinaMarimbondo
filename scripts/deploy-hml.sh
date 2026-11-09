#!/bin/bash
# Deploy do ambiente de homologação no k3s (executado na EC2 via SSH pelo pipeline).
# Uso: deploy-hml.sh <imagem> <arquivo-manifesto>
# Requer as variáveis NEW_RELIC_LICENSE_KEY (opcional).
set -euo pipefail

IMAGE="$1"
MANIFEST="$2"
PROD_NS="oficina-marimb0ndo"
HML_NS="oficina-hml"
HML_DB="oficina_db_hml"
K="sudo kubectl"

# Reaproveita host/usuário do RDS e segredos da produção, trocando só o database
DB_HOST=$($K get configmap oficina-config -n "$PROD_NS" -o jsonpath='{.data.DB_HOST}')
DB_USER=$($K get configmap oficina-config -n "$PROD_NS" -o jsonpath='{.data.DB_USER}')
DB_PASS=$($K get secret oficina-secret -n "$PROD_NS" -o jsonpath='{.data.DB_PASS}' | base64 -d)
JWT_SECRET=$($K get secret oficina-secret -n "$PROD_NS" -o jsonpath='{.data.JWT_SECRET}' | base64 -d)

# 1. Namespace + Deployment + Service (imagem fixada pelo SHA do commit)
sed "s|__IMAGE__|${IMAGE}|" "$MANIFEST" | $K apply -f -

# 2. ConfigMap e Secret de homologação
$K create configmap oficina-config -n "$HML_NS" \
  --from-literal=NODE_ENV=production \
  --from-literal=APP_ENV=homolog \
  --from-literal=PORT=3000 \
  --from-literal=DB_HOST="$DB_HOST" \
  --from-literal=DB_PORT=5432 \
  --from-literal=DB_NAME="$HML_DB" \
  --from-literal=DB_USER="$DB_USER" \
  --from-literal=DB_SYNCHRONIZE=true \
  --from-literal=JWT_EXPIRES_IN=24h \
  --from-literal=SMTP_HOST=smtp.ethereal.email \
  --from-literal=SMTP_PORT=587 \
  --from-literal=SMTP_FROM=noreply@oficina.com \
  --from-literal="NEW_RELIC_APP_NAME=Oficina Marimbondo API (HML)" \
  --dry-run=client -o yaml | $K apply -f -

$K create secret generic oficina-secret -n "$HML_NS" \
  --from-literal=DB_PASS="$DB_PASS" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=NEW_RELIC_LICENSE_KEY="${NEW_RELIC_LICENSE_KEY:-}" \
  --dry-run=client -o yaml | $K apply -f -

# 3. Garante que o database de homologação existe no RDS (idempotente)
$K delete pod create-hml-db -n "$HML_NS" --ignore-not-found
$K run create-hml-db -n "$HML_NS" --image=postgres:15-alpine --restart=Never --rm -i \
  --env="PGPASSWORD=$DB_PASS" -- \
  sh -c "psql -h '$DB_HOST' -U '$DB_USER' -d postgres -tc \"SELECT 1 FROM pg_database WHERE datname='$HML_DB'\" | grep -q 1 \
         || psql -h '$DB_HOST' -U '$DB_USER' -d postgres -c 'CREATE DATABASE $HML_DB'"

# 4. Reinicia para pegar config nova e aguarda o rollout
$K rollout restart deployment/oficina-api -n "$HML_NS"
$K rollout status deployment/oficina-api -n "$HML_NS" --timeout=180s
echo "Homologação atualizada com $IMAGE"
