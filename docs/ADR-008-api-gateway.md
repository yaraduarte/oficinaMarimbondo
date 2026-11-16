# ADR-008 — API Gateway explícito com authorizer JWT

**Status:** Aceito
**Data:** 2026-11-09
**Autora:** Yara Laurito (RM373819)

## Contexto

Feedback da Fase 3: só existia o API Gateway criado implicitamente pelo evento `/auth` do SAM, e a API no k3s era acessada diretamente pelo IP da EC2. É preciso um gateway declarado à frente da aplicação, com authorizer JWT.

## Decisão

- **Amazon API Gateway HTTP API declarado em Terraform**, no repositório `oficina-infra-k8s`, como porta única de entrada.
- **Lambda authorizer (REQUEST)** que valida o `Authorization: Bearer <jwt>`: assinatura HS256, `iss=oficina-marimb0ndo-auth`, `aud=oficina-marimb0ndo-api` e `exp`. Ela repassa `sub`, `role` e `status` no contexto e mantém um cache de 5 minutos por token.
- Rotas:

| Rota | Integração | Autorização |
|---|---|---|
| `POST /auth` | Lambda `oficina-auth` | pública |
| `ANY /os/{proxy+}` | os-service (k3s Ingress) | authorizer JWT |
| `ANY /billing/{proxy+}` | billing-service | authorizer JWT |
| `POST /billing/webhooks/mercadopago` | billing-service | pública, validada por `x-signature` |
| `ANY /execucao/{proxy+}` | execution-service | authorizer JWT |

- **Fechamento do k3s:** o Security Group libera só a porta do Ingress (Traefik). O Gateway injeta o header `x-origin-verify` com um segredo, e o Ingress rejeita requisições sem ele. As rotas `/internal/*` não são publicadas no Gateway.

## Justificativa

- O authorizer JWT nativo do HTTP API exige um emissor OIDC com JWKS público. Como o token é emitido pela nossa Lambda com segredo compartilhado (HS256), a Lambda authorizer é o caminho mais simples, e a lógica de validação fica coberta por testes unitários.
- O header secreto de origem fecha o acesso direto sem precisar de VPC Link + NLB, que teria custo mensal fixo.

## Alternativas consideradas

- **Migrar para RS256 + JWKS e usar o JWT authorizer nativo:** fica registrada como evolução, porque exige publicar as chaves e rotacioná-las.
- **Kong/NGINX dentro do k3s como gateway:** atende, mas não resolve a exposição direta da EC2 e duplica o que o API Gateway gerenciado oferece.

## Consequências

- Toda chamada externa fica auditável nos logs de acesso do API Gateway (CloudWatch).
- Os serviços continuam validando o JWT (defesa em profundidade), mas a borda já barra tokens inválidos ou de clientes não ativos.
