variable "project_id" {
  description = "The Google Cloud Project ID"
  type        = string
  default     = "spendigo-8540c"
}

variable "region" {
  description = "The default region for resources"
  type        = string
  default     = "northamerica-northeast1" # Montreal (Low latency, Data Residency compliant)
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}
