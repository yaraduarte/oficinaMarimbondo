# ADR-004 — Autenticação Stateless com JWT

**Status:** Aceito  
**Data:** 2026-07-15  
**Autor:** Yara Laurito (RM373819)

## Contexto

Com múltiplas réplicas da API rodando via HPA, a autenticação precisa ser stateless — sem sessão armazenada em memória ou banco.

## Decisão

**JWT (JSON Web Token)** assinado com HS256, validade de 24h, transportado via header `Authorization: Bearer <token>`.

## Justificativa

- Stateless por natureza — qualquer réplica valida o token sem consultar banco
- Payload carrega `sub` (userId ou clientId), `role` e `type` — dispensa lookup em cada requisição
- Implementação simples com `jsonwebtoken` (Node.js)
- Dois tipos de token: `type: mechanic/admin` (login interno) e `type: client` (autenticação por CPF via Lambda)

## Consequências

- Token não pode ser invalidado antes do vencimento (sem blacklist)
- Secret key deve ser rotacionada via variável de ambiente (`JWT_SECRET`)
- HTTPS obrigatório em produção para evitar interceptação do Bearer token
