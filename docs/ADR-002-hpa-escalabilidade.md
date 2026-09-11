# ADR-002 — Uso de HPA para Escalabilidade Horizontal

**Status:** Aceito  
**Data:** 2026-07-15  
**Autor:** Yara Laurito (RM373819)

## Contexto

Com a expansão para múltiplas unidades, a API precisa suportar picos de carga sem intervenção manual. Era necessário definir a estratégia de escalabilidade.

## Decisão

Usar **Horizontal Pod Autoscaler (HPA)** no Kubernetes com as seguintes configurações:

```yaml
minReplicas: 2
maxReplicas: 10
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
```

## Justificativa

- **2 réplicas mínimas:** garante alta disponibilidade — se um pod falhar, o outro continua atendendo
- **10 réplicas máximas:** limite para controle de custos em ambiente de demonstração
- **60% CPU:** threshold conservador — escala antes de atingir saturação, evitando degradação de latência
- **Horizontal vs Vertical:** escalonamento horizontal é mais resiliente e sem downtime

## Consequências

- metrics-server obrigatório no cluster para leitura de CPU
- Aplicação deve ser stateless (sem sessão em memória) — já garantido pelo JWT
- RDS pode se tornar gargalo com muitas réplicas — mitigado pelo connection pooling do TypeORM
