# ADR-007 — Banco de dados por serviço (PostgreSQL + DynamoDB)

**Status:** Aceito
**Data:** 2026-11-09
**Autora:** Yara Laurito (RM373819)

## Contexto

O enunciado exige um banco próprio por microsserviço, com pelo menos um relacional e um não relacional, e proíbe o acesso de um serviço ao banco de outro.

## Decisão

| Serviço | Banco | Modelo |
|---|---|---|
| os-service | PostgreSQL 15 (RDS), database `os_db` | Relacional: clientes, veículos, catálogo, OS, saga e outbox |
| execution-service | PostgreSQL 15 (RDS), database `execution_db` | Relacional: fila de execução e estoque, com locks de linha na reserva |
| billing-service | **Amazon DynamoDB** | Documentos: tabelas `billing-quotes` e `billing-payments`, com chave `id` e GSI `osId` |

`os_db` e `execution_db` ficam na mesma instância RDS por custo, com **usuários distintos** e `GRANT` apenas no próprio database. Logicamente são bancos independentes, e cada serviço só conhece a sua connection string.

## Justificativa

- **os-service:** dados cadastrais com relacionamentos e unicidade (CPF, placa), além da necessidade de transação local para a saga com outbox.
- **execution-service:** a reserva de estoque exige consistência forte (`SELECT ... FOR UPDATE`) para não reservar a mesma peça duas vezes.
- **billing-service no DynamoDB:**
  - orçamento e pagamento são documentos acessados por chave e por `osId`, sem joins;
  - o payload do Mercado Pago varia conforme o meio de pagamento, então um esquema flexível evita migrações;
  - escritas condicionais (`attribute_not_exists`) dão idempotência para webhooks repetidos;
  - é serverless e cabe no free tier.

## Alternativas consideradas

- **MongoDB no k3s para o billing:** consome memória da EC2 e exige backup próprio.
- **Instância RDS separada por serviço:** isola melhor, mas triplica o custo, sem ganho para a avaliação.

## Consequências

- Os testes do billing usam DynamoDB Local no docker-compose e no CI.
- Relatórios que cruzam domínios (ex.: faturamento por cliente) são compostos por API, ou futuramente por um read model alimentado por eventos, e nunca por join entre bancos.
