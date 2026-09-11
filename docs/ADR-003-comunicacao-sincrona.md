# ADR-003 — Padrão de Comunicação Síncrona (REST)

**Status:** Aceito  
**Data:** 2026-07-15  
**Autor:** Yara Laurito (RM373819)

## Contexto

Era necessário definir o padrão de comunicação entre cliente e API — REST, GraphQL ou mensageria assíncrona.

## Decisão

**REST sobre HTTP** com JSON como formato de troca de dados.

## Justificativa

- Operações de CRUD são naturalmente mapeáveis para verbos HTTP (GET/POST/PUT/DELETE)
- Swagger/OpenAPI documenta e testa REST de forma nativa
- Equipe familiar com REST — menor curva de aprendizado
- Notificações ao cliente (e-mail/WhatsApp) são assíncronas internamente mas não exigem mensageria externa no escopo atual

## Alternativas descartadas

- **GraphQL:** Overhead de implementação sem benefício claro para o modelo de dados atual
- **gRPC:** Mais adequado para comunicação inter-serviços — não há microsserviços no escopo
- **Mensageria (SQS/RabbitMQ):** Considerada para notificações, mas o volume atual não justifica a complexidade

## Consequências

- API documentada via Swagger UI em `/api-docs`
- Contratos bem definidos com `requestBody` e `responses` em todos os endpoints
- Futura evolução para eventos (notificações de OS) pode usar SQS sem alterar a API REST
