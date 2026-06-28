# Oficina Marimb0ndo API

API REST para gerenciamento completo de oficina mecânica, desenvolvida para o Tech Challenge da FIAP (Fases 1 e 2).

## Descrição do Sistema

O sistema gerencia o fluxo completo de uma oficina mecânica:
- Cadastro de **clientes** (CPF/CNPJ com validação)
- Cadastro de **veículos** (placas no padrão antigo e Mercosul)
- Gerenciamento de **peças** em estoque (com alertas de estoque baixo)
- Catálogo de **serviços** com preços e horas estimadas
- **Ordens de Serviço (OS)** com ciclo de vida completo:
  - Criação com cálculo automático de orçamento
  - Fluxo: RECEBIDA → EM_DIAGNOSTICO → AGUARDANDO_APROVACAO → EM_EXECUCAO → FINALIZADA → ENTREGUE
  - Aprovação/rejeição de orçamento pelo cliente
  - Notificações por e-mail em mudanças de status

## Tecnologias Utilizadas

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Node.js | 20 | Runtime |
| TypeScript | 5 | Linguagem |
| Express | 4 | Framework web |
| TypeORM | 0.3 | ORM |
| PostgreSQL | 15 | Banco de dados |
| JWT | - | Autenticação |
| bcryptjs | - | Hash de senhas |
| Nodemailer | - | E-mails |
| Swagger | - | Documentação |
| Jest + Supertest | - | Testes |
| Docker + Compose | - | Containerização |
| Kubernetes (Kind) | - | Orquestração |
| Terraform | 1.5+ | IaC |

## Arquitetura: Clean Architecture (Hexagonal)

```
src/
├── domain/                    # Núcleo do negócio (sem dependências externas)
│   ├── entities/              # Entidades puras TypeScript
│   │   ├── Client.ts
│   │   ├── Vehicle.ts
│   │   ├── Part.ts
│   │   ├── Service.ts
│   │   ├── ServiceOrder.ts
│   │   └── User.ts
│   ├── repositories/          # Interfaces de repositório
│   │   ├── IClientRepository.ts
│   │   ├── IVehicleRepository.ts
│   │   ├── IPartRepository.ts
│   │   ├── IServiceRepository.ts
│   │   ├── IServiceOrderRepository.ts
│   │   └── IUserRepository.ts
│   └── enums/
│       ├── ServiceOrderStatus.ts
│       └── UserRole.ts
│
├── application/               # Casos de uso (regras de negócio)
│   ├── use-cases/
│   │   ├── auth/              # LoginUseCase, RegisterUserUseCase
│   │   ├── client/            # CRUD de clientes
│   │   ├── vehicle/           # CRUD de veículos
│   │   ├── part/              # CRUD de peças
│   │   ├── service/           # CRUD de serviços
│   │   └── service-order/     # Lógica da OS
│   └── dtos/                  # Data Transfer Objects
│
├── infrastructure/            # Adaptadores externos
│   ├── database/
│   │   ├── data-source.ts     # Configuração TypeORM
│   │   ├── entities/          # Entidades TypeORM (com decoradores)
│   │   ├── migrations/        # Migrações
│   │   └── repositories/      # Implementações TypeORM
│   ├── web/
│   │   ├── controllers/       # Controllers Express (finos)
│   │   ├── routes/            # Definição de rotas + Swagger JSDoc
│   │   ├── middlewares/       # Auth JWT, error handler
│   │   └── swagger/           # Configuração Swagger
│   └── email/                 # Nodemailer
│
├── shared/                    # Utilitários compartilhados
│   ├── errors/                # AppError
│   └── validators/            # CPF/CNPJ, Placa
│
├── __tests__/                 # Testes unitários
├── app.ts                     # Configuração Express
└── server.ts                  # Entry point
```

## Como Executar Localmente (Docker Compose)

```bash
# 1. Clone o repositório
git clone <repo-url>
cd oficina-marimb0ndo-api

# 2. Configure variáveis de ambiente
cp .env.example .env

# 3. Suba os containers
docker-compose up -d

# 4. Acesse a API
curl http://localhost:3000/health

# 5. Acesse o Swagger
open http://localhost:3000/api-docs
```

### Desenvolvimento sem Docker

```bash
# Instale dependências
npm install

# Configure .env com PostgreSQL local
cp .env.example .env

# Execute em modo desenvolvimento
npm run dev
```

## Como Executar com Kubernetes (Kind)

```bash
# 1. Crie o cluster Kind
kind create cluster --name oficina-cluster

# 2. Build da imagem
docker build -t oficina-marimb0ndo-api:latest .

# 3. Carregue a imagem no cluster
kind load docker-image oficina-marimb0ndo-api:latest --name oficina-cluster

# 4. Aplique os manifestos
kubectl apply -f k8s/

# 5. Aguarde os pods
kubectl get pods -n oficina-marimb0ndo -w

# 6. Acesse a API
curl http://localhost:30080/health
```

## Como Provisionar com Terraform

```bash
cd infra

# Copie e configure as variáveis
cp terraform.tfvars.example terraform.tfvars
# Edite terraform.tfvars

# Inicialize
terraform init

# Planeje
terraform plan

# Aplique
terraform apply

# Para destruir
terraform destroy
```

## Endpoints Principais

### Autenticação (pública)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/register | Registrar usuário |
| POST | /api/auth/login | Obter token JWT |

### Ordens de Serviço (parcialmente pública)
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | /api/service-orders/:id/status | Status da OS | Não |
| POST | /api/service-orders/:id/approve | Aprovar/rejeitar orçamento | Não |
| POST | /api/service-orders | Criar OS | Sim |
| GET | /api/service-orders | Listar OS ativas (ordenadas) | Sim |
| PATCH | /api/service-orders/:id/status | Avançar status | Sim |

### Clientes, Veículos, Peças, Serviços
Todos requerem autenticação JWT (Bearer token).

```
GET/POST   /api/clients
GET/PUT/DELETE /api/clients/:id

GET/POST   /api/vehicles?clientId=xxx
GET/PUT/DELETE /api/vehicles/:id

GET/POST   /api/parts
GET/PUT/DELETE /api/parts/:id

GET/POST   /api/services
GET/PUT/DELETE /api/services/:id
```

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| NODE_ENV | Ambiente | development |
| PORT | Porta da API | 3000 |
| DB_HOST | Host PostgreSQL | localhost |
| DB_PORT | Porta PostgreSQL | 5432 |
| DB_NAME | Nome do banco | oficina_db |
| DB_USER | Usuário PostgreSQL | postgres |
| DB_PASS | Senha PostgreSQL | postgres123 |
| JWT_SECRET | Chave secreta JWT | - |
| JWT_EXPIRES_IN | Expiração do token | 24h |
| SMTP_HOST | Host SMTP | smtp.ethereal.email |
| SMTP_PORT | Porta SMTP | 587 |
| SMTP_USER | Usuário SMTP | - |
| SMTP_PASS | Senha SMTP | - |
| SMTP_FROM | E-mail remetente | noreply@oficina.com |

## Testes

```bash
# Executar todos os testes
npm test

# Com coverage
npm test -- --coverage

# Arquivo específico
npm test -- CreateServiceOrderUseCase
```

### Cobertura de Testes

- `CreateServiceOrderUseCase` — cálculo de orçamento, validações, estoque
- `ListServiceOrdersUseCase` — ordenação por prioridade, exclusão de FINALIZADA/ENTREGUE
- `ApproveQuoteUseCase` — aprovação/rejeição com notificação e-mail
- `LoginUseCase` — autenticação JWT, credenciais inválidas
- `CPF/CNPJ Validator` — casos válidos e inválidos
- `ServiceOrder Status Transitions` — transições válidas e inválidas

## Regras de Negócio Importantes

### Ordenação das OS ativas
A listagem `/api/service-orders` exibe apenas OS ativas (exclui FINALIZADA e ENTREGUE) ordenadas por:
1. **EM_EXECUCAO** (prioridade 1)
2. **AGUARDANDO_APROVACAO** (prioridade 2)
3. **EM_DIAGNOSTICO** (prioridade 3)
4. **RECEBIDA** (prioridade 4)
5. Dentro do mesmo status: mais antigas primeiro

### Fluxo de Aprovação de Orçamento
- Somente OS com status `AGUARDANDO_APROVACAO` podem ser aprovadas/rejeitadas
- Aprovação → `EM_EXECUCAO` (envia e-mail de confirmação)
- Rejeição → `FINALIZADA` (envia e-mail de rejeição)

### Validação de Placa
- Padrão antigo: `ABC-1234` (3 letras + 4 dígitos)
- Padrão Mercosul: `ABC1D23` (3 letras + 1 dígito + 1 letra + 2 dígitos)

### CPF/CNPJ
Validação completa com algoritmo de dígitos verificadores (sem biblioteca externa).
