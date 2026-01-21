terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  backend "s3" {
    bucket = "hscopalm-terraform-backend"
    key    = "shareable-wishlists/prod/terraform.tfstate"
    region = "us-east-1"
  }

  required_version = ">= 1.2.0"
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "shareable-wishlists"
      Environment = var.environment
      Terraform   = "true"
    }
  }
} 