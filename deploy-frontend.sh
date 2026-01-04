#!/bin/bash

# Frontend Deployment Script to S3 with CloudFront Invalidation
# This script builds the React app and deploys it to S3, then invalidates CloudFront cache

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration (can be overridden by environment variables)
AWS_REGION="${AWS_REGION:-us-east-1}"
FRONTEND_DIR="$(cd "$(dirname "$0")/frontend" && pwd)"

echo -e "${GREEN}=== Frontend Deployment Script ===${NC}"

# Check if required tools are installed
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed. Aborting.${NC}" >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo -e "${RED}AWS CLI is required but not installed. Aborting.${NC}" >&2; exit 1; }

# Get S3 bucket and CloudFront distribution ID from Terraform outputs
echo -e "${YELLOW}Fetching infrastructure details from Terraform...${NC}"
cd terraform
S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")
CLOUDFRONT_DIST_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")
cd ..

if [ -z "$S3_BUCKET" ] || [ -z "$CLOUDFRONT_DIST_ID" ]; then
    echo -e "${RED}Error: Could not retrieve S3 bucket name or CloudFront distribution ID from Terraform.${NC}"
    echo -e "${YELLOW}Please run 'terraform apply' first or set S3_BUCKET and CLOUDFRONT_DIST_ID manually.${NC}"
    exit 1
fi

echo -e "${GREEN}S3 Bucket: ${S3_BUCKET}${NC}"
echo -e "${GREEN}CloudFront Distribution: ${CLOUDFRONT_DIST_ID}${NC}"

# Build the React app
echo -e "${YELLOW}Building React app...${NC}"
cd "$FRONTEND_DIR"
npm install
npm run build

if [ ! -d "build" ]; then
    echo -e "${RED}Build directory not found. Build may have failed.${NC}"
    exit 1
fi

echo -e "${GREEN}Build completed successfully!${NC}"

# Sync to S3
echo -e "${YELLOW}Syncing build files to S3...${NC}"
aws s3 sync build/ "s3://${S3_BUCKET}/" \
    --region "$AWS_REGION" \
    --delete \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "index.html" \
    --exclude "manifest.json"

# Upload index.html and manifest.json with shorter cache (they change more often)
echo -e "${YELLOW}Uploading index.html and manifest.json with shorter cache...${NC}"
aws s3 cp build/index.html "s3://${S3_BUCKET}/index.html" \
    --region "$AWS_REGION" \
    --cache-control "public,max-age=300,must-revalidate" \
    --content-type "text/html"

if [ -f "build/manifest.json" ]; then
    aws s3 cp build/manifest.json "s3://${S3_BUCKET}/manifest.json" \
        --region "$AWS_REGION" \
        --cache-control "public,max-age=300,must-revalidate" \
        --content-type "application/json"
fi

echo -e "${GREEN}S3 sync completed!${NC}"

# Invalidate CloudFront cache
echo -e "${YELLOW}Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DIST_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${GREEN}CloudFront invalidation created: ${INVALIDATION_ID}${NC}"
echo -e "${YELLOW}Waiting for invalidation to complete (this may take a few minutes)...${NC}"

aws cloudfront wait invalidation-completed \
    --distribution-id "$CLOUDFRONT_DIST_ID" \
    --id "$INVALIDATION_ID"

echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo -e "${GREEN}Frontend is now live at https://www.giftguru.cc${NC}"
