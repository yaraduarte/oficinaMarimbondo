# Roteiro de testes e do vídeo — Fase 4

O vídeo deve ter **até 15 minutos** e ir para o YouTube ou Vimeo como público ou não listado. O roteiro cobre os quatro itens que o enunciado exige no vídeo:

1. fluxo completo de uma OS passando pelos microsserviços;
2. execução do Saga Pattern e tratamento de falhas;
3. deploy automatizado de pelo menos um microsserviço com validação de testes;
4. monitoramento e rastreamento dos fluxos distribuídos.

---

## 0. Preparação (antes de gravar, sem câmera)

### 0.1 Ligar o ambiente
1. No AWS Academy, clique em **Start Lab** e espere a bolinha ficar verde. A EC2, o RDS e o IP elástico `52.0.25.64` voltam sozinhos.
2. Copie as credenciais (AWS Details → AWS CLI → Show) para `C:\Users\Administrador\.aws\credentials`.
3. Atualize os secrets da AWS no GitHub, porque as credenciais do Learner Lab expiram a cada sessão:
   ```bash
   bash scripts/lab/refresh-aws-secrets.sh
   ```
4. Confirme que tudo está de pé:
   ```bash
   curl -s https://l3t36ga0t1.execute-api.us-east-1.amazonaws.com/os/health
   curl -s https://l3t36ga0t1.execute-api.us-east-1.amazonaws.com/billing/health
   curl -s https://l3t36ga0t1.execute-api.us-east-1.amazonaws.com/execucao/health
   ```

### 0.2 Dados de demonstração
Rode uma vez. O script cria o administrador e o mecânico (por dentro do cluster, porque o cadastro de funcionário não é exposto no Gateway), o cliente, o veículo, o serviço, a peça e o saldo da peça no estoque da execução:
```bash
bash scripts/lab/seed-demo.sh
```
Ele imprime e salva em `scripts/lab/.demo.env`:
- `ADMIN_TOKEN`, `MECH_TOKEN`
- `CLIENT_CPF`, `CLIENT_ID`, `VEHICLE_ID`
- `SERVICE_ID`, `PART_ID`, `PART_SEM_ESTOQUE_ID`

Carregue essas variáveis no terminal que você vai usar na gravação:
```bash
source scripts/lab/.demo.env
G=https://l3t36ga0t1.execute-api.us-east-1.amazonaws.com
```

### 0.3 Abas abertas no navegador
1. GitHub Actions do `oficina-execution-service`.
2. New Relic → APM & Services, com os 3 serviços.
3. Swagger: abra o `docs/openapi.json` de cada repositório em https://editor.swagger.io (File → Import URL, usando o link *raw* do GitHub). Pelo Gateway o `/api-docs` exige JWT, então o navegador não abre direto.
4. Mercado Pago: conta de **comprador de teste**, para pagar o checkout.
5. Diagrama da arquitetura (o PDF de entrega).

---

## 1. Abertura (≈1 min)

**Mostrar:** o diagrama da arquitetura.

**Falar:**
- **Três microsserviços**, cada um com repositório, pipeline e banco próprios:
  - **os-service**: PostgreSQL, orquestrador da Saga;
  - **billing-service**: DynamoDB e Mercado Pago;
  - **execution-service**: PostgreSQL `execution_db`, fila e estoque.
- Entrada única pelo **API Gateway**, com um authorizer JWT em Lambda e o login do cliente por CPF em outra Lambda.
- Comunicação **síncrona** por REST só pelo Gateway e na consulta interna da Lambda.
- Comunicação **assíncrona** por **RabbitMQ**: comandos e eventos da Saga.
- Nenhum serviço acessa o banco de outro.

---

## 2. Fluxo completo de uma OS (≈5 min)

### 2.1 Atendente abre a OS → Saga pede orçamento ao billing
```bash
curl -s -X POST $G/os/api/service-orders -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"clientId\":\"$CLIENT_ID\",\"vehicleId\":\"$VEHICLE_ID\",\"serviceIds\":[\"$SERVICE_ID\"],\"parts\":[{\"partId\":\"$PART_ID\",\"quantity\":1}]}" | tee /tmp/os.json
OS_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/os.json')).data.id)")
```

Consulte a Saga e o status. Em poucos segundos a OS passa a `AGUARDANDO_APROVACAO`:
```bash
curl -s $G/os/api/service-orders/$OS_ID/saga -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Falar:** o os-service gravou a OS e o comando `billing.GerarOrcamento` na mesma transação (outbox). O billing gerou o orçamento no DynamoDB e respondeu com `billing.OrcamentoGerado`.

### 2.2 Cliente se autentica por CPF e aprova o orçamento
```bash
CLIENT_TOKEN=$(curl -s -X POST $G/auth -H 'Content-Type: application/json' -d "{\"cpf\":\"$CLIENT_CPF\"}" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).token))")
curl -s "$G/billing/orcamentos?osId=$OS_ID" -H "Authorization: Bearer $CLIENT_TOKEN" | tee /tmp/q.json
QUOTE_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/q.json')).data[0].id)")
curl -s -X POST $G/billing/orcamentos/$QUOTE_ID/aprovar -H "Authorization: Bearer $CLIENT_TOKEN"
```

A resposta traz o `checkoutUrl` (Mercado Pago Checkout Pro). A OS passa a `AGUARDANDO_PAGAMENTO`.

### 2.3 Pagamento no Mercado Pago
1. Abra o `checkoutUrl` no navegador, logado como **comprador de teste**.
2. Pague com cartão de teste aprovado:
   - Mastercard `5031 4332 1540 6351`;
   - CVV `123`;
   - validade `11/30`;
   - **nome do titular `APRO`**;
   - CPF `12345678909`.
3. **Falar:** o Mercado Pago chama `POST /billing/webhooks/mercadopago` pelo Gateway (rota pública). O billing valida o `x-signature` (HMAC) e **consulta o pagamento na API do MP**, que é a fonte da verdade. Em seguida publica `billing.PagamentoConfirmado`.
4. Consulte a Saga. A OS fica `EM_FILA`, e o orquestrador enviou `execution.IniciarExecucao`.

### 2.4 Oficina executa (execution-service)
```bash
curl -s $G/execucao/execucoes/fila -H "Authorization: Bearer $MECH_TOKEN" | tee /tmp/fila.json
EXEC_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/fila.json')).data.find(e=>e.osId==='$OS_ID').id)")
curl -s $G/execucao/estoque -H "Authorization: Bearer $MECH_TOKEN"        # peça reservada
curl -s -X POST $G/execucao/execucoes/$EXEC_ID/diagnostico -H "Authorization: Bearer $MECH_TOKEN"
curl -s -X POST $G/execucao/execucoes/$EXEC_ID/reparo      -H "Authorization: Bearer $MECH_TOKEN"
curl -s -X POST $G/execucao/execucoes/$EXEC_ID/finalizar   -H "Authorization: Bearer $MECH_TOKEN"
```

Depois de cada passo, mostre a OS mudando: `EM_DIAGNOSTICO`, depois `EM_EXECUCAO`, depois `FINALIZADA`. A Saga termina como `CONCLUIDA`:
```bash
curl -s $G/os/api/service-orders/$OS_ID/saga -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 3. Saga e tratamento de falhas (≈3 min)

Mostre pelo menos **um** dos cenários abaixo. O cenário B mostra a compensação completa, com estorno.

### A) Cliente recusa o orçamento
Abra outra OS como no passo 2.1 e recuse:
```bash
curl -s -X POST $G/billing/orcamentos/$QUOTE_ID/recusar -H "Authorization: Bearer $CLIENT_TOKEN" -H 'Content-Type: application/json' -d '{"reason":"Valor acima do esperado"}'
```
A Saga vai para `COMPENSADA` e a OS para `CANCELADA`, sem nada a estornar.

### B) Falta de estoque depois do pagamento: compensação com estorno
1. Abra uma OS com a peça **sem estoque** (`$PART_SEM_ESTOQUE_ID`), aprove e pague como no passo 2.
2. O execution-service responde `execution.ExecucaoRecusada` (`ESTOQUE_INSUFICIENTE`).
3. O orquestrador compensa **na ordem inversa**: `billing.EstornarPagamento` (refund real no MP) e depois `billing.CancelarOrcamento`.
4. Mostre o histórico da Saga, com os passos de compensação e o motivo:
   ```bash
   curl -s $G/os/api/service-orders/$OS_ID/saga -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
5. Mostre o estorno no painel do Mercado Pago (vendedor de teste).

### C) Falha durante o reparo
Com uma OS `EM_FILA`, registre a falha:
```bash
curl -s -X POST $G/execucao/execucoes/$EXEC_ID/falha -H "Authorization: Bearer $MECH_TOKEN" -H 'Content-Type: application/json' -d '{"reason":"Peça incompatível com o veículo"}'
```
As peças voltam ao estoque (`GET /execucao/estoque`), e a Saga estorna e cancela.

**Falar:**
- **Orquestração** em vez de coreografia: o fluxo tem compensações em ordem e timeout de aprovação, e um orquestrador central deixa o estado explícito e auditável (ADR-005).
- **Outbox** nos produtores: banco e mensagem nunca divergem.
- **Idempotência** por `messageId`/`sagaId`.
- **Retry** com 3 tentativas e depois **DLQ**.

---

## 4. Deploy automatizado com validação de testes (≈3 min)

1. Faça uma mudança pequena no `oficina-execution-service`. Exemplo: um texto do Swagger em `src/infrastructure/web/swagger.ts`.
2. Abra a branch, o commit e o PR:
   ```bash
   git checkout -b feature/demo-video
   git commit -am "docs: ajuste no Swagger"
   git push -u origin feature/demo-video
   ```
3. Abra o PR para `homolog` e mostre os checks:
   - **Testes**: lint, build, 45 testes com PostgreSQL real e cobertura acima de 80%; mostre o *Summary* com a tabela de cobertura;
   - **Qualidade (SonarQube)**: quality gate *PASSED* e métricas no *Summary*.
4. Mostre a proteção de branch: `main` e `homolog` só aceitam merge via PR com os dois checks verdes.
5. Faça o merge `homolog` → `main`. Mostre o pipeline:
   - **Build e Push Docker** (`yaraduarte/oficina-execution-service:<sha>`);
   - **Deploy**, com `kubectl apply` e `rollout status` no k3s.
6. Confirme a versão nova no ar: `curl $G/execucao/health` mostra `uptime` baixo, porque o pod acabou de reiniciar. Mostre também o deployment com a imagem nova:
   ```bash
   ssh -i oficina-k3s-key ec2-user@52.0.25.64 "sudo kubectl get deploy execution-service -n oficina-marimb0ndo -o wide"
   ```

---

## 5. Monitoramento e rastreamento (≈2 min)

1. No **New Relic APM**, mostre os 3 serviços: Oficina Marimbondo API, Billing e Execution.
2. Abra **Distributed tracing** e filtre por um trace do fluxo da OS. Mostre os spans:
   - Gateway → os-service;
   - os-service → RabbitMQ (`traceparent` propagado nos headers AMQP);
   - transações de background `Billing/billing.GerarOrcamento` e `Execution/execution.IniciarExecucao`.
3. Mostre **Logs in context** e os erros, por exemplo a falha forçada no cenário C.
4. **RabbitMQ** (opcional): mostre as filas e consumidores (`billing.commands`, `execution.commands`, `os.saga.events`) e as DLQs vazias:
   ```bash
   ssh -i oficina-k3s-key ec2-user@52.0.25.64 "sudo kubectl exec -n oficina-marimb0ndo deploy/rabbitmq -- rabbitmqctl list_queues name consumers messages"
   ```
5. **CloudWatch**: logs de acesso do API Gateway (`/aws/apigateway/oficina-gateway`).

---

## 6. Encerramento (≈30 s)

Recapitule:
- 3 microsserviços com SQL + NoSQL;
- Saga orquestrada com compensação;
- CI/CD com testes, SonarQube e deploy em Kubernetes;
- observabilidade com New Relic.

---

## Checklist de testes (antes de gravar)

| # | Teste | Resultado esperado |
|---|---|---|
| 1 | `GET /os/health`, `/billing/health`, `/execucao/health` | 200 nos três |
| 2 | Rota protegida sem token (`GET /billing/orcamentos`) | 401 do authorizer |
| 3 | Token de cliente em `/execucao/execucoes` | 403 (só funcionários) |
| 4 | Webhook sem assinatura (`POST /billing/webhooks/mercadopago`) | 401 |
| 5 | Abrir OS | Saga `AGUARDANDO_APROVACAO` em segundos |
| 6 | Aprovar orçamento | `checkoutUrl` do Mercado Pago, OS `AGUARDANDO_PAGAMENTO` |
| 7 | Pagar com cartão `APRO` | OS `EM_FILA`, execução na fila, peça reservada |
| 8 | Diagnóstico → reparo → finalizar | OS `FINALIZADA`, Saga `CONCLUIDA`, baixa no estoque |
| 9 | Recusar orçamento | Saga `COMPENSADA`, OS `CANCELADA` |
| 10 | Pagar OS com peça sem estoque | `ExecucaoRecusada`, estorno no MP, OS `CANCELADA` |
| 11 | PR com teste quebrado | Check **Testes** vermelho, merge bloqueado |
| 12 | Merge em `main` | Build, push e deploy verdes; health 200 |
| 13 | New Relic | 3 serviços e trace distribuído do fluxo |
