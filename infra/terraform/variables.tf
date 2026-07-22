variable "project_id" {
  type        = string
  description = "GCP project ID hosting the mint-handoff Cloud Run service."
}

variable "region" {
  type        = string
  description = "Cloud Run region."
  default     = "us-central1"
}

variable "image" {
  type        = string
  description = <<-EOT
    Fully-qualified container image for the service, e.g.
    us-central1-docker.pkg.dev/<project>/refi/handoff:<tag>. Build & push with
    `gcloud builds submit services/handoff --tag <image>` before apply.
  EOT
}

variable "shell_base_url" {
  type        = string
  description = "Investor shell origin the token redirects into."
  default     = "https://refi-us-sec-ia-web.vercel.app"
}

variable "allowed_origin" {
  type        = string
  description = "CORS allow-origin for the game frontend that calls the service."
  default     = "*"
}
