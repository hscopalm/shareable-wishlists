#!/bin/bash
# Combined Deployment Script for Wishlist Application
# Deploys backend (Docker to ECS) and/or frontend (React to S3/CloudFront)

set -e

# Default target
TARGET="${1:-Both}"

# Validate target
if [[ ! "$TARGET" =~ ^(Backend|Frontend|Both)$ ]]; then
    echo "Invalid target: $TARGET"
    echo "Usage: ./deploy.sh [Backend|Frontend|Both]"
    exit 1
fi

# AWS Configuration
AWS_ACCOUNT_ID="471112920823"
AWS_REGION="us-east-1"
CLUSTER_NAME="wishlist-cluster-prod"
BACKEND_SERVICE_NAME="wishlist-backend-prod"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo -e "\033[36m=== Wishlist Deployment Script ===\033[0m"
echo -e "\033[36mDeployment Target: $TARGET\033[0m"
echo ""

# Function to check if ECS service is stable
wait_ecs_service_stability() {
    local cluster_name="$1"
    local service_name="$2"

    echo -e "\033[33mWaiting for $service_name to stabilize...\033[0m"

    while true; do
        service_json=$(aws ecs describe-services --cluster "$cluster_name" --services "$service_name" --region "$AWS_REGION")
        running_count=$(echo "$service_json" | jq -r '.services[0].deployments[] | select(.status == "PRIMARY") | .runningCount')
        desired_count=$(echo "$service_json" | jq -r '.services[0].deployments[] | select(.status == "PRIMARY") | .desiredCount')

        if [[ "$running_count" == "$desired_count" ]]; then
            break
        fi

        echo -e "\033[90mService $service_name - Running: $running_count/$desired_count tasks...\033[0m"
        sleep 10
    done

    echo -e "\033[32mService $service_name has stabilized!\033[0m"
}

# Function to deploy backend
deploy_backend() {
    echo ""
    echo -e "\033[32m===== DEPLOYING BACKEND =====\033[0m"

    # Log into ECR
    echo -e "\033[33mLogging into ECR...\033[0m"
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

    if [[ $? -ne 0 ]]; then
        echo -e "\033[31mFailed to login to ECR.\033[0m"
        exit 1
    fi

    # Build backend image
    echo -e "\033[33mBuilding backend Docker image...\033[0m"
    docker build -t wishlist-backend:latest "$BACKEND_DIR"

    if [[ $? -ne 0 ]]; then
        echo -e "\033[31mBackend build failed.\033[0m"
        exit 1
    fi

    # Tag backend image
    echo -e "\033[33mTagging backend image...\033[0m"
    docker tag wishlist-backend:latest "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wishlist-backend:latest"

    # Push backend image
    echo -e "\033[33mPushing backend image to ECR...\033[0m"
    docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wishlist-backend:latest"

    if [[ $? -ne 0 ]]; then
        echo -e "\033[31mFailed to push backend image.\033[0m"
        exit 1
    fi

    # Force new deployment
    echo -e "\033[33mForcing new ECS deployment...\033[0m"
    aws ecs update-service --cluster "$CLUSTER_NAME" --service "$BACKEND_SERVICE_NAME" --force-new-deployment --region "$AWS_REGION" > /dev/null

    if [[ $? -ne 0 ]]; then
        echo -e "\033[31mFailed to update ECS service.\033[0m"
        exit 1
    fi

    # Wait for service to stabilize
    wait_ecs_service_stability "$CLUSTER_NAME" "$BACKEND_SERVICE_NAME"

    echo -e "\033[32mBackend deployment completed!\033[0m"
}

# Function to deploy frontend
deploy_frontend() {
    echo ""
    echo -e "\033[32m===== DEPLOYING FRONTEND =====\033[0m"

    # Get S3 bucket and CloudFront distribution ID from Terraform outputs
    echo -e "\033[33mFetching infrastructure details from Terraform...\033[0m"
    pushd "$SCRIPT_DIR/terraform" > /dev/null

    S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")
    CLOUDFRONT_DIST_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")

    popd > /dev/null

    if [[ -z "$S3_BUCKET" || -z "$CLOUDFRONT_DIST_ID" ]]; then
        echo -e "\033[31mError: Could not retrieve S3 bucket or CloudFront distribution ID.\033[0m"
        echo -e "\033[33mPlease run 'terraform apply' first.\033[0m"
        exit 1
    fi

    echo -e "\033[36mS3 Bucket: $S3_BUCKET\033[0m"
    echo -e "\033[36mCloudFront Distribution: $CLOUDFRONT_DIST_ID\033[0m"

    # Build the React app
    echo -e "\033[33mBuilding React app...\033[0m"
    pushd "$FRONTEND_DIR" > /dev/null

    npm install
    npm run build

    if [[ $? -ne 0 ]]; then
        echo -e "\033[31mReact build failed.\033[0m"
        popd > /dev/null
        exit 1
    fi

    BUILD_DIR="$FRONTEND_DIR/build"
    if [[ ! -d "$BUILD_DIR" ]]; then
        echo -e "\033[31mBuild directory not found. Build may have failed.\033[0m"
        popd > /dev/null
        exit 1
    fi

    echo -e "\033[32mBuild completed successfully!\033[0m"

    # Sync to S3
    echo -e "\033[33mSyncing build files to S3...\033[0m"
    aws s3 sync build/ "s3://$S3_BUCKET/" \
        --region "$AWS_REGION" \
        --delete \
        --cache-control "public,max-age=31536000,immutable" \
        --exclude "index.html" \
        --exclude "manifest.json"

    if [[ $? -ne 0 ]]; then
        echo -e "\033[31mS3 sync failed.\033[0m"
        popd > /dev/null
        exit 1
    fi

    # Upload index.html and manifest.json with shorter cache
    echo -e "\033[33mUploading index.html with shorter cache...\033[0m"
    aws s3 cp build/index.html "s3://$S3_BUCKET/index.html" \
        --region "$AWS_REGION" \
        --cache-control "public,max-age=300,must-revalidate" \
        --content-type "text/html"

    if [[ $? -ne 0 ]]; then
        echo -e "\033[31mFailed to upload index.html.\033[0m"
        popd > /dev/null
        exit 1
    fi

    if [[ -f "build/manifest.json" ]]; then
        aws s3 cp build/manifest.json "s3://$S3_BUCKET/manifest.json" \
            --region "$AWS_REGION" \
            --cache-control "public,max-age=300,must-revalidate" \
            --content-type "application/json"
    fi

    popd > /dev/null
    echo -e "\033[32mS3 sync completed!\033[0m"

    # Invalidate CloudFront cache
    echo -e "\033[33mInvalidating CloudFront cache...\033[0m"
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DIST_ID" \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)

    if [[ $? -ne 0 ]]; then
        echo -e "\033[31mFailed to create CloudFront invalidation.\033[0m"
        exit 1
    fi

    echo -e "\033[36mCloudFront invalidation created: $INVALIDATION_ID\033[0m"
    echo -e "\033[33mWaiting for invalidation to complete...\033[0m"

    aws cloudfront wait invalidation-completed \
        --distribution-id "$CLOUDFRONT_DIST_ID" \
        --id "$INVALIDATION_ID"

    if [[ $? -ne 0 ]]; then
        echo -e "\033[31mFailed waiting for invalidation to complete.\033[0m"
        exit 1
    fi

    echo -e "\033[32mFrontend deployment completed!\033[0m"
}

# Main deployment logic
case "$TARGET" in
    "Backend")
        deploy_backend
        ;;
    "Frontend")
        deploy_frontend
        ;;
    "Both")
        deploy_backend
        deploy_frontend
        ;;
esac

echo ""
echo -e "\033[32m=== DEPLOYMENT COMPLETE ===\033[0m"
echo -e "\033[36mApplication is live at: https://www.giftguru.cc\033[0m"
