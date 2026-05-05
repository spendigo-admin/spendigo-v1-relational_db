terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.51.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ------------------------------------------------------------------------------
# Storage Buckets (Lifecycle Policies for Cost Control)
# ------------------------------------------------------------------------------

resource "google_storage_bucket" "public_assets" {
  name          = "${var.project_id}-public-assets"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  versioning {
    enabled = true
  }

  # Keep last 5 versions of each asset; older versions are deleted automatically
  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket" "flyer_uploads" {
  name          = "${var.project_id}-flyer-uploads"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  # Move to Coldline after 30 days; hard-delete after 1 year
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }
}

# Dedicated backup bucket — same region as Firestore database (required by export API)
resource "google_storage_bucket" "firestore_backups" {
  name          = "${var.project_id}-firestore-backups"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  # Enforce a 90-day minimum retention on all backup objects
  retention_policy {
    retention_period = 7776000
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# ------------------------------------------------------------------------------
# Cloud Functions (Backend)
# ------------------------------------------------------------------------------

# Note: Actual functions deployed via CI/CD, but we define the API Gateway or Trigger topics here if needed.
# For simplest "Pre-Revenue" setup, we rely on HTTP triggers directly initially.

# ------------------------------------------------------------------------------
# Database (Placeholder for External Provider)
# ------------------------------------------------------------------------------
# Since we use Neon/Supabase (External), we don't provision Cloud SQL here 
# to save the $50/mo minimum cost.
