variable "cluster_name" {
  description = "Nome do cluster Kind"
  type        = string
  default     = "oficina-cluster"
}

variable "db_pass" {
  description = "Senha do PostgreSQL (base64)"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Chave secreta JWT (base64)"
  type        = string
  sensitive   = true
}

variable "smtp_user" {
  description = "Usuário SMTP (base64)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "smtp_pass" {
  description = "Senha SMTP (base64)"
  type        = string
  sensitive   = true
  default     = ""
}
