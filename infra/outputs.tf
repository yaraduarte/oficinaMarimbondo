output "cluster_name" {
  description = "Nome do cluster Kind criado"
  value       = kind_cluster.oficina.name
}

output "cluster_endpoint" {
  description = "Endpoint do cluster"
  value       = kind_cluster.oficina.endpoint
}

output "api_url" {
  description = "URL da API (NodePort)"
  value       = "http://localhost:30080"
}

output "swagger_url" {
  description = "URL do Swagger"
  value       = "http://localhost:30080/api-docs"
}
