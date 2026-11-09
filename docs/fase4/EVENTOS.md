# Contratos de mensagens — Saga da Ordem de Serviço

Este documento é a fonte da verdade dos contratos trocados via RabbitMQ entre os microsserviços. Toda mudança de contrato passa por PR neste arquivo antes de chegar ao código.

## 1. Topologia RabbitMQ

| Exchange | Tipo | Uso |
|---|---|---|
| `oficina.commands` | direct | Comandos do orquestrador para um serviço específico |
| `oficina.events` | topic | Eventos publicados pelos serviços |
| `oficina.dlx` | fanout | Dead-letter de todas as filas |

| Fila | Binding | Consumidor |
|---|---|---|
| `billing.commands` | `oficina.commands` / `billing` | billing-service |
| `execution.commands` | `oficina.commands` / `execution` | execution-service |
| `os.saga.events` | `oficina.events` / `billing.#`, `execution.#` | os-service (orquestrador) |
| `*.dlq` | `oficina.dlx` | inspeção/reprocessamento manual |

Filas `durable`, mensagens `persistent`, `x-dead-letter-exchange=oficina.dlx`, retry com backoff exponencial (3 tentativas) antes da DLQ.

## 2. Envelope padrão

```json
{
  "messageId": "6f1c0e2a-...",
  "type": "billing.OrcamentoGerado",
  "version": 1,
  "sagaId": "b4a9...",
  "correlationId": "b4a9...",
  "causationId": "id da mensagem que originou esta",
  "osId": "uuid da OS",
  "occurredAt": "2026-11-09T15:00:00.000Z",
  "producer": "billing-service",
  "payload": { }
}
```

- Headers AMQP: `traceparent` e `newrelic`, para o distributed tracing, e `x-retry-count`.
- `messageId` serve de chave de idempotência: o consumidor ignora mensagens já processadas.
- Valores monetários em **centavos** (inteiro), moeda BRL.

## 3. Comandos (orquestrador → serviços)

| Comando | Routing key | Payload | Respostas possíveis |
|---|---|---|---|
| `billing.GerarOrcamento` | `billing` | `{ clientId, clientEmail, vehicleId, items: [{ kind: "SERVICE"\|"PART", refId, description, quantity, unitPriceCents }] }` | `OrcamentoGerado` |
| `billing.CancelarOrcamento` | `billing` | `{ quoteId, reason }` | `OrcamentoCancelado` |
| `billing.EstornarPagamento` | `billing` | `{ paymentId, reason }` | `PagamentoEstornado`, `EstornoFalhou` |
| `execution.IniciarExecucao` | `execution` | `{ quoteId, priority, services: [{ serviceId, description }], parts: [{ partId, quantity }] }` | `ExecucaoIniciada`, `ExecucaoRecusada` |
| `execution.CancelarExecucao` | `execution` | `{ executionId, reason }` | `ExecucaoCancelada` |

## 4. Eventos (serviços → orquestrador)

### billing-service

| Evento | Payload | Efeito no orquestrador |
|---|---|---|
| `billing.OrcamentoGerado` | `{ quoteId, totalCents, expiresAt }` | OS → `AGUARDANDO_APROVACAO`; agenda timeout |
| `billing.OrcamentoAprovado` | `{ quoteId, paymentId, checkoutUrl }` | OS → `AGUARDANDO_PAGAMENTO` |
| `billing.OrcamentoRecusado` | `{ quoteId, reason }` | saga → `COMPENSANDO`; OS → `CANCELADA` |
| `billing.PagamentoConfirmado` | `{ paymentId, quoteId, mpPaymentId, amountCents, paidAt }` | OS → `EM_FILA`; envia `IniciarExecucao` |
| `billing.PagamentoRecusado` | `{ paymentId, quoteId, mpStatus, mpStatusDetail }` | compensa: `CancelarOrcamento` |
| `billing.PagamentoEstornado` | `{ paymentId, mpRefundId, amountCents }` | avança a compensação |
| `billing.EstornoFalhou` | `{ paymentId, error }` | retry; após o limite, vai para a DLQ e saga → `FALHA_COMPENSACAO` |
| `billing.OrcamentoCancelado` | `{ quoteId }` | conclui a compensação |

### execution-service

| Evento | Payload | Efeito no orquestrador |
|---|---|---|
| `execution.ExecucaoIniciada` | `{ executionId, queuePosition, reservedParts: [{ partId, quantity }] }` | mantém `EM_FILA` e registra o `executionId` |
| `execution.ExecucaoRecusada` | `{ reason: "ESTOQUE_INSUFICIENTE", missingParts: [{ partId, requested, available }] }` | compensa: `EstornarPagamento` → `CancelarOrcamento` |
| `execution.DiagnosticoIniciado` | `{ executionId, mechanicId }` | OS → `EM_DIAGNOSTICO` |
| `execution.ReparoIniciado` | `{ executionId }` | OS → `EM_EXECUCAO` |
| `execution.ExecucaoFinalizada` | `{ executionId, finishedAt, consumedParts }` | OS → `FINALIZADA`; saga → `CONCLUIDA` |
| `execution.ExecucaoFalhou` | `{ executionId, reason }` | compensa (peças já liberadas localmente) |
| `execution.ExecucaoCancelada` | `{ executionId }` | avança a compensação |

## 5. Versionamento

- O campo `version` é incrementado em mudanças incompatíveis, e os consumidores aceitam a versão atual e a anterior durante a transição.
- Campos novos opcionais não exigem nova versão.
