# RFC-001 — Escolha da Nuvem e Estratégia de Infraestrutura

**Status:** Aceito  
**Data:** 2026-07-15  
**Autor:** Yara Laurito (RM373819)

## Contexto

A Fase 3 do Tech Challenge exige infraestrutura em nuvem com API Gateway, Function Serverless, banco de dados gerenciado e cluster Kubernetes. Era necessário escolher um provedor cloud e definir a estratégia de provisionamento.

## Decisão

Adotar **AWS** como provedor principal com as seguintes escolhas:

| Componente | Serviço escolhido | Alternativa considerada |
|---|---|---|
| Serverless | AWS Lambda + API Gateway | Google Cloud Functions |
| Banco gerenciado | AWS RDS PostgreSQL 15 | Cloud SQL / PlanetScale |
| Kubernetes | EC2 + k3s | EKS / GKE |
| IaC | Terraform | AWS CloudFormation |
| Observabilidade | New Relic | Datadog |

## Justificativas

**AWS:** Plataforma com maior adoção de mercado, documentação mais madura e free tier que cobre Lambda (1M req/mês), RDS db.t3.micro (750h/mês) e EC2 t3.micro. A disciplina de Desenvolvimento Serverless da FIAP utiliza AWS como referência.

**k3s em vez de EKS:** O EKS tem custo fixo de $0,10/hora (~$72/mês) independente de uso. O k3s instalado em EC2 t3.medium cobre os mesmos requisitos (HPA, namespaces, deployments) sem custo adicional além da instância.

**Terraform:** Ferramenta agnóstica de nuvem, já utilizada nas Fases 1 e 2 do projeto. Permite reprodutibilidade e versionamento da infraestrutura.

**New Relic:** Free tier de 100GB/mês de ingestão de dados, sem cartão de crédito. Suporta APM para Node.js, dashboards customizados e alertas — atende todos os requisitos de observabilidade da Fase 3.

## Consequências

- Infraestrutura dentro do free tier da AWS para fins acadêmicos
- k3s tem limitações de alta disponibilidade (single node) — aceitável para demonstração
- Lock-in parcial na AWS (Lambda/API Gateway), mitigado pelo uso de Terraform
