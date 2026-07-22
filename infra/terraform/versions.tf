terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  # Use a remote encrypted backend (GCS) per environment; no secrets live in
  # this config (secret *values* are added out-of-band via gcloud).
  # backend "gcs" { bucket = "refi-tfstate-<env>" prefix = "handoff" }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
