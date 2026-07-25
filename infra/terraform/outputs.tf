output "service_url" {
  description = "Public URL of the mint-handoff Cloud Run service (set as VITE_HANDOFF_URL in the game build)."
  value       = google_cloud_run_v2_service.handoff.uri
}

output "runtime_service_account" {
  description = "Cloud Run runtime service account (reads the secrets)."
  value       = google_service_account.handoff.email
}
