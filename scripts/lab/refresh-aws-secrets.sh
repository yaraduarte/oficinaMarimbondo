#!/bin/bash
# Copia as credenciais da sessão atual do AWS Academy Learner Lab (~/.aws/credentials)
# para os secrets AWS_* dos repositórios de infraestrutura. Rode a cada nova sessão do lab.
set -euo pipefail
get() { grep -E "^\s*$1\s*=" ~/.aws/credentials | head -1 | sed -E 's/^[^=]*=\s*//' | tr -d '\r'; }
aws sts get-caller-identity --query Arn --output text
for repo in oficina-infra-db oficina-lambda-auth oficina-infra-k8s; do
  gh secret set AWS_ACCESS_KEY_ID -R "yaraduarte/$repo" --body "$(get aws_access_key_id)" >/dev/null
  gh secret set AWS_SECRET_ACCESS_KEY -R "yaraduarte/$repo" --body "$(get aws_secret_access_key)" >/dev/null
  gh secret set AWS_SESSION_TOKEN -R "yaraduarte/$repo" --body "$(get aws_session_token)" >/dev/null
  echo "$repo: AWS_* atualizados"
done
