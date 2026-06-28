# Infraestrutura com Terraform + Kind

## Pré-requisitos

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- [Kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation)
- [Docker](https://docs.docker.com/get-docker/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)

## Como aplicar

```bash
# 1. Copie o arquivo de variáveis
cp terraform.tfvars.example terraform.tfvars

# 2. Edite terraform.tfvars com seus valores

# 3. Inicialize o Terraform
terraform init

# 4. Visualize o plano
terraform plan

# 5. Aplique
terraform apply

# 6. Acesse a API
curl http://localhost:30080/health

# 7. Para destruir
terraform destroy
```

## Outputs

Após o `apply`, o Terraform exibirá:
- `cluster_name`: nome do cluster Kind
- `cluster_endpoint`: endpoint Kubernetes
- `api_url`: URL da API (http://localhost:30080)
- `swagger_url`: URL do Swagger (http://localhost:30080/api-docs)
