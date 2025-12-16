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
}

resource "google_storage_bucket" "flyer_uploads" {
  name          = "${var.project_id}-flyer-uploads"
  location      = var.region
  force_destroy = false
  
  # COST CONTROL: Auto-delete raw uploads after 7 days
  lifecycle_rule {
    condition {
      age = 7
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
