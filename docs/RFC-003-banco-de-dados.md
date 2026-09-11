# RFC-003 — Escolha e Modelagem do Banco de Dados

**Status:** Aceito  
**Data:** 2026-07-15  
**Autor:** Yara Laurito (RM373819)

## Contexto

A aplicação gerencia clientes, veículos, peças, serviços e ordens de serviço com relacionamentos complexos e requisitos de integridade referencial. Era necessário justificar a escolha do banco e documentar o modelo relacional.

## Decisão

**PostgreSQL 15** como banco de dados relacional gerenciado via **AWS RDS db.t3.micro**.

## Justificativa

| Critério | PostgreSQL | MySQL | MongoDB |
|---|---|---|---|
| Integridade referencial | ✅ FK com CASCADE | ✅ | ❌ |
| JSONB para dados flexíveis | ✅ nativo | ❌ | ✅ |
| UUID como PK | ✅ nativo | ⚠️ varchar | ✅ |
| Soft delete com index | ✅ partial index | ⚠️ | ❌ |
| Free tier AWS | ✅ db.t3.micro | ✅ | ❌ RDS |
| Suporte TypeORM | ✅ | ✅ | ✅ |

PostgreSQL foi escolhido pela robustez em integridade referencial (ordens de serviço com múltiplas FKs), suporte nativo a UUID e capacidade de usar partial indexes para soft delete eficiente.

## Diagrama ER

```
┌─────────────┐       ┌─────────────┐
│   users     │       │   clients   │
│─────────────│       │─────────────│
│ id (PK)     │       │ id (PK)     │
│ name        │       │ name        │
│ email       │       │ cpf_cnpj    │◄── único, validado
│ password    │       │ email       │
│ role        │       │ phone       │
│ created_at  │       │ deleted_at  │◄── soft delete
└─────────────┘       └──────┬──────┘
                             │ 1
                             │
                           N │
                      ┌──────▼──────┐
                      │  vehicles   │
                      │─────────────│
                      │ id (PK)     │
                      │ client_id   │◄── FK clients
                      │ plate       │◄── único, Mercosul/antigo
                      │ brand       │
                      │ model       │
                      │ year        │
                      │ deleted_at  │◄── soft delete
                      └──────┬──────┘
                             │ 1
                             │
┌─────────────┐            N │
│   parts     │      ┌───────▼──────────┐
│─────────────│      │  service_orders  │
│ id (PK)     │      │──────────────────│
│ name        │      │ id (PK)          │
│ description │      │ order_number     │◄── OS-2026-001
│ unit_price  │      │ client_id        │◄── FK clients
│ stock_qty   │      │ vehicle_id       │◄── FK vehicles
│ min_stock   │      │ status           │◄── enum máquina de estados
└──────┬──────┘      │ budget           │
       │             │ notes            │
       │ N           │ created_at       │
       │             └──────┬───────────┘
┌──────▼──────────────┐     │ N
│ service_order_parts │     │
│─────────────────────│     │
│ service_order_id FK │     │
│ part_id          FK │     │
│ quantity            │     │
└─────────────────────┘     │ N
                      ┌─────▼───────────────┐
┌─────────────┐       │ service_order_serv. │
│  services   │       │─────────────────────│
│─────────────│       │ service_order_id FK │
│ id (PK)     │◄──────│ service_id       FK │
│ name        │       └─────────────────────┘
│ description │
│ price       │
│ est_hours   │
└─────────────┘
```

## Status da Ordem de Serviço (máquina de estados)

```
RECEBIDA → EM_DIAGNOSTICO → AGUARDANDO_APROVACAO → EM_EXECUCAO → FINALIZADA → ENTREGUE
```

Transições inválidas retornam HTTP 422.

## Ajustes na Fase 3

- Índices adicionados em `cpf_cnpj`, `plate` e `order_number` para performance
- `deleted_at IS NULL` em todas as queries de listagem (soft delete)
- SSL obrigatório na conexão com RDS (`rejectUnauthorized: false` para certificado self-signed)
