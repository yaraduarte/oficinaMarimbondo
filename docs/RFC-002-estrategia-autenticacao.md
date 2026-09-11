# RFC-002 — Estratégia de Autenticação por CPF via Serverless

**Status:** Aceito  
**Data:** 2026-07-15  
**Autor:** Yara Laurito (RM373819)

## Contexto

A Fase 3 exige autenticação por CPF protegendo rotas sensíveis da API, com uma Function Serverless responsável por validar o CPF, consultar o cliente e gerar o JWT.

## Decisão

Implementar dois fluxos de autenticação paralelos:

1. **Autenticação interna (mecânicos/admins):** JWT via `POST /api/auth/login` com e-mail + senha (já existia na Fase 1)
2. **Autenticação de clientes por CPF:** AWS Lambda (`POST /auth` via API Gateway) que valida o CPF, consulta o RDS e devolve JWT

## Fluxo de autenticação por CPF

```
Cliente → POST /auth { cpf } → API Gateway → Lambda
                                                │
                                    1. Valida formato CPF (algoritmo dígitos verificadores)
                                    2. Busca no RDS: SELECT * FROM clients WHERE cpf_cnpj = $1
                                    3. Gera JWT com sub=clientId, type=client
                                                │
                                    ← 200 { token, expiresIn, client }
```

## Validação do CPF

A Lambda implementa o algoritmo completo de validação dos dígitos verificadores do CPF, rejeitando sequências inválidas (000.000.000-00, etc.) com HTTP 422 antes de consultar o banco.

## JWT

O token gerado contém:
```json
{
  "sub": "uuid-do-cliente",
  "name": "Nome do Cliente",
  "email": "email@cliente.com",
  "cpf": "11144477735",
  "type": "client",
  "iat": 1234567890,
  "exp": 1234654290
}
```

## Alternativas consideradas

- **Amazon Cognito:** Mais complexo para autenticação por CPF customizado; custo após 50.000 usuários ativos
- **Auth0:** Free tier limitado; dependência de terceiros para funcionalidade core
- **Lambda customizado:** Escolhido — controle total, sem custo adicional no free tier

## Consequências

- Lambda conecta diretamente ao RDS — requer que ambos estejam na mesma VPC em produção
- JWT tem validade de 24h — aceitável para o contexto da oficina
- CPF como identificador único garante que o cliente não precisa lembrar senha
