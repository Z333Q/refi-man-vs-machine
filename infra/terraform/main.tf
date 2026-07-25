# mint-handoff — Cloud Run service + secrets + least-privilege IAM.
# Portable HCL: the service reads Postgres over DATABASE_URL (Neon now, Cloud
# SQL later) and signs with a private JWK from Secret Manager. Secret *values*
# are added out-of-band (gcloud) so they never enter Terraform state.

resource "google_project_service" "run" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_service_account" "handoff" {
  account_id   = "refi-alpha-handoff"
  display_name = "ReFi Alpha mint-handoff (Cloud Run runtime)"
}

# Secret containers only — add versions with:
#   gcloud secrets versions add alpha-handoff-private-key --data-file=priv.jwk.json
#   printf '%s' "$DATABASE_URL" | gcloud secrets versions add handoff-database-url --data-file=-
resource "google_secret_manager_secret" "private_key" {
  secret_id  = "alpha-handoff-private-key"
  replication { auto {} }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret" "database_url" {
  secret_id  = "handoff-database-url"
  replication { auto {} }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_iam_member" "private_key_access" {
  secret_id = google_secret_manager_secret.private_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.handoff.email}"
}

resource "google_secret_manager_secret_iam_member" "database_url_access" {
  secret_id = google_secret_manager_secret.database_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.handoff.email}"
}

resource "google_cloud_run_v2_service" "handoff" {
  name     = "mint-handoff"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.handoff.email
    containers {
      image = var.image
      ports { container_port = 8080 }

      env {
        name  = "SHELL_BASE_URL"
        value = var.shell_base_url
      }
      env {
        name  = "ALLOWED_ORIGIN"
        value = var.allowed_origin
      }
      env {
        name = "ALPHA_HANDOFF_PRIVATE_KEY_JWK"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.private_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.run,
    google_secret_manager_secret_iam_member.private_key_access,
    google_secret_manager_secret_iam_member.database_url_access,
  ]
}

# The game frontend calls this from the browser, so it is publicly invocable.
# The endpoint validates input and only mints short-lived, single-use tokens;
# identity hardening (auth) is the documented follow-on. Tighten to an
# authenticated caller once the game has real auth.
resource "google_cloud_run_v2_service_iam_member" "invoker" {
  name     = google_cloud_run_v2_service.handoff.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
