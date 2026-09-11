# Diagramas de Arquitetura — Oficina Marimbondo Fase 3

## Diagrama de Componentes (visão cloud)

```
┌──────────────────────────────────────────────────────────────────────┐
│                           AWS Cloud (us-east-1)                      │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                        VPC Default                              │ │
│  │                                                                 │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐  │ │
│  │  │ API Gateway  │    │   Lambda     │    │   EC2 t3.medium   │  │ │
│  │  │              │───►│ oficina-auth │    │   (k3s cluster)   │  │ │
│  │  │ POST /auth   │    │              │    │                   │  │ │
│  │  └──────────────┘    │ 1.Valida CPF │    │  ┌─────────────┐  │  │ │
│  │         │            │ 2.Consulta DB│    │  │  oficina-   │  │  │ │
│  │         │            │ 3.Gera JWT   │    │  │  api (x2)   │  │  │ │
│  │         │            └──────┬───────┘    │  └──────┬──────┘  │  │ │
│  │         │                   │            │         │          │  │ │
│  │         │            ┌──────▼──────────────────────▼────────┐│  │ │
│  │         │            │        RDS PostgreSQL 15              ││  │ │
│  │         │            │        db.t3.micro                    ││  │ │
│  │         │            │        oficina-marimb0ndo-db          ││  │ │
│  │         │            └───────────────────────────────────────┘│  │ │
│  │         │                                                      │  │ │
│  └─────────┼──────────────────────────────────────────────────────┘  │
│            │                                                          │
│  ┌─────────▼──────────┐                                              │
│  │  S3 Bucket         │                                              │
│  │  (Terraform state) │                                              │
│  └────────────────────┘                                              │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         GitHub                                       │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ oficina-lambda   │  │ oficina-infra-k8s │  │ oficina-infra-db │  │
│  │ GitHub Actions   │  │ GitHub Actions   │  │ GitHub Actions   │  │
│  │ sam deploy       │  │ terraform apply  │  │ terraform apply  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ oficinaMarimbondo — GitHub Actions                           │   │
│  │ test → build → push ghcr.io → kubectl set image             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────┐
│          New Relic (Observabilidade)   │
│                                        │
│  • APM Node.js (latência, throughput)  │
│  • Logs estruturados JSON              │
│  • Alertas de falha em OS              │
│  • Dashboard: volume OS, tempo/status  │
└────────────────────────────────────────┘
```

## Diagrama de Sequência — Autenticação por CPF

```
Cliente          API Gateway        Lambda           RDS PostgreSQL
   │                  │                │                    │
   │  POST /auth      │                │                    │
   │  { cpf }         │                │                    │
   │─────────────────►│                │                    │
   │                  │  invoke Lambda │                    │
   │                  │───────────────►│                    │
   │                  │                │  Valida formato    │
   │                  │                │  CPF (dígitos)     │
   │                  │                │                    │
   │                  │                │  SELECT * FROM     │
   │                  │                │  clients WHERE     │
   │                  │                │  cpf_cnpj = $1     │
   │                  │                │───────────────────►│
   │                  │                │                    │
   │                  │                │  { id, name, email}│
   │                  │                │◄───────────────────│
   │                  │                │                    │
   │                  │                │  jwt.sign(payload) │
   │                  │                │  exp: 24h          │
   │                  │                │                    │
   │                  │  200 { token } │                    │
   │                  │◄───────────────│                    │
   │  200 { token,    │                │                    │
   │    expiresIn,    │                │                    │
   │    client }      │                │                    │
   │◄─────────────────│                │                    │
```

## Diagrama de Sequência — Abertura de Ordem de Serviço

```
Mecânico    API (k3s)      RDS PostgreSQL     New Relic
   │             │                │                │
   │  POST /api/auth/login        │                │
   │  { email, password }         │                │
   │────────────►│                │                │
   │             │  SELECT users  │                │
   │             │───────────────►│                │
   │             │  { user }      │                │
   │             │◄───────────────│                │
   │  JWT token  │                │                │
   │◄────────────│                │                │
   │             │                │                │
   │  POST /api/service-orders    │                │
   │  Authorization: Bearer JWT   │                │
   │  { clientId, vehicleId,      │                │
   │    serviceIds, parts }       │                │
   │────────────►│                │                │
   │             │  valida JWT    │                │
   │             │  verifica FK   │                │
   │             │───────────────►│                │
   │             │  INSERT OS     │                │
   │             │  calcula budget│                │
   │             │◄───────────────│                │
   │             │                │  log JSON      │
   │             │                │───────────────►│
   │  201 {      │                │                │
   │    id,      │                │                │
   │    orderNum,│                │                │
   │    status,  │                │                │
   │    budget } │                │                │
   │◄────────────│                │                │
```
