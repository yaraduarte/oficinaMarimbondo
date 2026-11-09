# ADR-006 — RabbitMQ como mensageria entre microsserviços

**Status:** Aceito
**Data:** 2026-11-09
**Autora:** Yara Laurito (RM373819)

## Contexto

A Saga precisa de comunicação assíncrona confiável entre os-service, billing-service e execution-service, com retry, dead-letter e roteamento de comandos (ponto a ponto) e eventos (publish/subscribe).

## Decisão

Usar **RabbitMQ 3.13**, rodando no cluster k3s como StatefulSet com volume persistente, com exchanges `oficina.commands` (direct), `oficina.events` (topic) e `oficina.dlx`.

## Justificativa

- Suporta nativamente os dois padrões de que a Saga precisa: direct para comandos e topic para eventos.
- Tem dead-letter exchange, TTL e confirmações de publicação (publisher confirms) sem código extra.
- Roda igual no `docker-compose` local e no k3s, o que facilita os testes de integração e BDD.
- O painel de gerenciamento deixa visíveis as filas e a DLQ durante a demonstração da Saga.
- Sem custo adicional na AWS.

## Alternativas consideradas

- **Amazon SQS/SNS:** gerenciado, mas exigiria SNS+SQS para fan-out, não tem equivalente local fiel (o LocalStack adiciona complexidade) e cria uma dependência de credenciais AWS em todos os testes.
- **Kafka:** excelente para streaming e replay, mas pesado demais para a EC2 t3.medium e para o volume do projeto.

## Consequências

- O broker fica auto-hospedado: a disponibilidade dele depende do cluster. A mitigação é volume persistente, filas `durable` e outbox no produtor, para que nada se perca se o broker cair.
- Credenciais do broker vão em Secret do Kubernetes, com um usuário por serviço.
