# ADR-005 — Saga orquestrada para o fluxo da Ordem de Serviço

**Status:** Aceito
**Data:** 2026-11-09
**Autora:** Yara Laurito (RM373819)

## Contexto

Na Fase 4 a abertura, o orçamento, o pagamento e a execução da OS ficam em três microsserviços, cada um com banco próprio. Não existe transação ACID entre eles, então é preciso coordenar o fluxo e desfazer etapas já concluídas quando uma etapa posterior falha (ex.: pagamento aprovado, mas sem peças em estoque).

## Decisão

Usar o **Saga Pattern orquestrado**, com o orquestrador dentro do **os-service**. O estado de cada saga fica na tabela `saga_instances` do `os_db`, e os comandos e eventos trafegam pelo RabbitMQ (ver [EVENTOS.md](fase4/EVENTOS.md)).

## Justificativa

- **O fluxo tem ordem rígida e compensações encadeadas** (estornar o pagamento antes de cancelar o orçamento). Com orquestração essa sequência fica explícita num único lugar, como máquina de estados testável com BDD.
- **Rastreabilidade:** o estado atual de qualquer OS e de sua saga é uma consulta no os-service, sem precisar reconstruir a história a partir de eventos espalhados. Isso também facilita a demonstração e o suporte.
- **Timeouts** (orçamento sem resposta em 72h) exigem um componente com memória do fluxo, que é o próprio orquestrador.
- **O os-service já é o dono do ciclo de vida da OS**, então colocar o orquestrador nele não cria um serviço extra para manter.
- **Equipe de uma pessoa:** menos acoplamento implícito entre serviços e depuração mais simples.

## Alternativas consideradas

- **Coreografia:** cada serviço reage aos eventos dos outros, sem coordenador central. Foi descartada porque a lógica de compensação ficaria distribuída em três repositórios, o risco de ciclos de eventos aumenta e é mais difícil responder "em que etapa está a OS X?".
- **Orquestrador como serviço dedicado** (ex.: Temporal, Step Functions): adicionaria infraestrutura e custo desproporcionais ao escopo.
- **2PC / transação distribuída:** incompatível com bancos heterogêneos (PostgreSQL + DynamoDB) e com a disponibilidade desejada.

## Consequências

- O os-service fica mais complexo e o orquestrador concentra responsabilidade. Isso é mitigado mantendo nele apenas a máquina de estados, com a lógica de negócio de cada etapa nos serviços participantes.
- Exige **outbox transacional** no os-service e **consumidores idempotentes** em todos os serviços.
- Toda compensação precisa ser idempotente: um estorno repetido não pode estornar duas vezes.
