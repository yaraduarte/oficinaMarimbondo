terraform {
  required_providers {
    kind = {
      source  = "tehcyx/kind"
      version = "~> 0.4"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
  }
  required_version = ">= 1.5"
}

provider "kind" {}

provider "kubernetes" {
  host                   = kind_cluster.oficina.endpoint
  cluster_ca_certificate = kind_cluster.oficina.cluster_ca_certificate
  client_certificate     = kind_cluster.oficina.client_certificate
  client_key             = kind_cluster.oficina.client_key
}

resource "kind_cluster" "oficina" {
  name = var.cluster_name

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"
      extra_port_mappings {
        container_port = 30080
        host_port      = 30080
        protocol       = "TCP"
      }
    }

    node {
      role = "worker"
    }
  }
}

resource "kubernetes_namespace" "oficina" {
  depends_on = [kind_cluster.oficina]

  metadata {
    name = "oficina-marimb0ndo"
    labels = {
      app = "oficina-marimb0ndo"
    }
  }
}

resource "kubernetes_config_map" "oficina_config" {
  depends_on = [kubernetes_namespace.oficina]

  metadata {
    name      = "oficina-config"
    namespace = "oficina-marimb0ndo"
  }

  data = {
    NODE_ENV      = "production"
    PORT          = "3000"
    DB_HOST       = "postgres-service"
    DB_PORT       = "5432"
    DB_NAME       = "oficina_db"
    DB_USER       = "postgres"
    JWT_EXPIRES_IN = "24h"
    SMTP_HOST     = "smtp.ethereal.email"
    SMTP_PORT     = "587"
    SMTP_FROM     = "noreply@oficina.com"
  }
}

resource "kubernetes_secret" "oficina_secret" {
  depends_on = [kubernetes_namespace.oficina]

  metadata {
    name      = "oficina-secret"
    namespace = "oficina-marimb0ndo"
  }

  data = {
    DB_PASS    = var.db_pass
    JWT_SECRET = var.jwt_secret
    SMTP_USER  = var.smtp_user
    SMTP_PASS  = var.smtp_pass
  }
}

resource "kubernetes_persistent_volume_claim" "postgres_pvc" {
  depends_on = [kubernetes_namespace.oficina]

  metadata {
    name      = "postgres-pvc"
    namespace = "oficina-marimb0ndo"
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "1Gi"
      }
    }
  }
}

resource "kubernetes_deployment" "postgres" {
  depends_on = [
    kubernetes_config_map.oficina_config,
    kubernetes_secret.oficina_secret,
    kubernetes_persistent_volume_claim.postgres_pvc,
  ]

  metadata {
    name      = "postgres"
    namespace = "oficina-marimb0ndo"
    labels = {
      app = "postgres"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "postgres"
      }
    }

    template {
      metadata {
        labels = {
          app = "postgres"
        }
      }

      spec {
        container {
          name  = "postgres"
          image = "postgres:15-alpine"

          port {
            container_port = 5432
          }

          env {
            name = "POSTGRES_DB"
            value_from {
              config_map_key_ref {
                name = "oficina-config"
                key  = "DB_NAME"
              }
            }
          }

          env {
            name = "POSTGRES_USER"
            value_from {
              config_map_key_ref {
                name = "oficina-config"
                key  = "DB_USER"
              }
            }
          }

          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = "oficina-secret"
                key  = "DB_PASS"
              }
            }
          }

          resources {
            requests = {
              memory = "256Mi"
              cpu    = "250m"
            }
            limits = {
              memory = "512Mi"
              cpu    = "500m"
            }
          }

          volume_mount {
            name       = "postgres-storage"
            mount_path = "/var/lib/postgresql/data"
          }

          readiness_probe {
            exec {
              command = ["pg_isready", "-U", "postgres"]
            }
            initial_delay_seconds = 10
            period_seconds        = 5
          }
        }

        volume {
          name = "postgres-storage"
          persistent_volume_claim {
            claim_name = "postgres-pvc"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "postgres_service" {
  depends_on = [kubernetes_deployment.postgres]

  metadata {
    name      = "postgres-service"
    namespace = "oficina-marimb0ndo"
  }

  spec {
    type = "ClusterIP"

    selector = {
      app = "postgres"
    }

    port {
      port        = 5432
      target_port = 5432
    }
  }
}

resource "kubernetes_deployment" "oficina_api" {
  depends_on = [
    kubernetes_service.postgres_service,
    kubernetes_config_map.oficina_config,
    kubernetes_secret.oficina_secret,
  ]

  metadata {
    name      = "oficina-api"
    namespace = "oficina-marimb0ndo"
    labels = {
      app = "oficina-api"
    }
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "oficina-api"
      }
    }

    template {
      metadata {
        labels = {
          app = "oficina-api"
        }
      }

      spec {
        container {
          name              = "oficina-api"
          image             = "oficina-marimb0ndo-api:latest"
          image_pull_policy = "IfNotPresent"

          port {
            container_port = 3000
          }

          env_from {
            config_map_ref {
              name = "oficina-config"
            }
          }

          env {
            name = "DB_PASS"
            value_from {
              secret_key_ref {
                name = "oficina-secret"
                key  = "DB_PASS"
              }
            }
          }

          env {
            name = "JWT_SECRET"
            value_from {
              secret_key_ref {
                name = "oficina-secret"
                key  = "JWT_SECRET"
              }
            }
          }

          resources {
            requests = {
              memory = "128Mi"
              cpu    = "250m"
            }
            limits = {
              memory = "256Mi"
              cpu    = "500m"
            }
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 15
            period_seconds        = 10
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 30
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "oficina_api_service" {
  depends_on = [kubernetes_deployment.oficina_api]

  metadata {
    name      = "oficina-api-service"
    namespace = "oficina-marimb0ndo"
  }

  spec {
    type = "NodePort"

    selector = {
      app = "oficina-api"
    }

    port {
      port        = 80
      target_port = 3000
      node_port   = 30080
    }
  }
}

resource "kubernetes_horizontal_pod_autoscaler" "oficina_api_hpa" {
  depends_on = [kubernetes_deployment.oficina_api]

  metadata {
    name      = "oficina-api-hpa"
    namespace = "oficina-marimb0ndo"
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = "oficina-api"
    }

    min_replicas = 2
    max_replicas = 10

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 60
        }
      }
    }
  }
}
