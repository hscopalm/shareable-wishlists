# Combined Deployment Script for Wishlist Application
# Deploys backend (Docker to ECS) and/or frontend (React to S3/CloudFront)

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("Backend", "Frontend", "Both")]
    [string]$Target = "Both"
)

# Exit on error
$ErrorActionPreference = "Stop"

# AWS Configuration
$AWS_ACCOUNT_ID = "471112920823"
$AWS_REGION = "us-east-1"
$CLUSTER_NAME = "wishlist-cluster-prod"
$BACKEND_SERVICE_NAME = "wishlist-backend-prod"
$FRONTEND_DIR = Join-Path $PSScriptRoot "frontend"
$BACKEND_DIR = Join-Path $PSScriptRoot "backend"

Write-Host "=== Wishlist Deployment Script ===" -ForegroundColor Cyan
Write-Host "Deployment Target: $Target" -ForegroundColor Cyan
Write-Host ""

# Function to check if ECS service is stable
function Wait-ECSServiceStability {
    param (
        [string]$ClusterName,
        [string]$ServiceName
    )
    
    Write-Host "Waiting for $ServiceName to stabilize..." -ForegroundColor Yellow
    do {
        $service = aws ecs describe-services --cluster $ClusterName --services $ServiceName --region $AWS_REGION | ConvertFrom-Json
        $deployment = $service.services[0].deployments | Where-Object { $_.status -eq "PRIMARY" }
        $isStable = $deployment.runningCount -eq $deployment.desiredCount
        
        if (-not $isStable) {
            Write-Host "Service $ServiceName - Running: $($deployment.runningCount)/$($deployment.desiredCount) tasks..." -ForegroundColor Gray
            Start-Sleep -Seconds 10
        }
    } while (-not $isStable)
    
    Write-Host "Service $ServiceName has stabilized!" -ForegroundColor Green
}

# Function to deploy backend
function Deploy-Backend {
    Write-Host ""
    Write-Host "===== DEPLOYING BACKEND =====" -ForegroundColor Green
    
    # Log into ECR
    Write-Host "Logging into ECR..." -ForegroundColor Yellow
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to login to ECR." -ForegroundColor Red
        exit 1
    }
    
    # Build backend image
    Write-Host "Building backend Docker image..." -ForegroundColor Yellow
    docker build -t wishlist-backend:latest $BACKEND_DIR
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Backend build failed." -ForegroundColor Red
        exit 1
    }
    
    # Tag backend image
    Write-Host "Tagging backend image..." -ForegroundColor Yellow
    docker tag wishlist-backend:latest "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wishlist-backend:latest"
    
    # Push backend image
    Write-Host "Pushing backend image to ECR..." -ForegroundColor Yellow
    docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/wishlist-backend:latest"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to push backend image." -ForegroundColor Red
        exit 1
    }
    
    # Force new deployment
    Write-Host "Forcing new ECS deployment..." -ForegroundColor Yellow
    aws ecs update-service --cluster $CLUSTER_NAME --service $BACKEND_SERVICE_NAME --force-new-deployment --region $AWS_REGION | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to update ECS service." -ForegroundColor Red
        exit 1
    }
    
    # Wait for service to stabilize
    Wait-ECSServiceStability -ClusterName $CLUSTER_NAME -ServiceName $BACKEND_SERVICE_NAME
    
    Write-Host "Backend deployment completed!" -ForegroundColor Green
}

# Function to deploy frontend
function Deploy-Frontend {
    Write-Host ""
    Write-Host "===== DEPLOYING FRONTEND =====" -ForegroundColor Green
    
    # Get S3 bucket and CloudFront distribution ID from Terraform outputs
    Write-Host "Fetching infrastructure details from Terraform..." -ForegroundColor Yellow
    Push-Location (Join-Path $PSScriptRoot "terraform")
    try {
        $S3_BUCKET = terraform output -raw s3_bucket_name 2>$null
        $CLOUDFRONT_DIST_ID = terraform output -raw cloudfront_distribution_id 2>$null
    } catch {
        $S3_BUCKET = ""
        $CLOUDFRONT_DIST_ID = ""
    }
    Pop-Location
    
    if ([string]::IsNullOrWhiteSpace($S3_BUCKET) -or [string]::IsNullOrWhiteSpace($CLOUDFRONT_DIST_ID)) {
        Write-Host "Error: Could not retrieve S3 bucket or CloudFront distribution ID." -ForegroundColor Red
        Write-Host "Please run 'terraform apply' first." -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "S3 Bucket: $S3_BUCKET" -ForegroundColor Cyan
    Write-Host "CloudFront Distribution: $CLOUDFRONT_DIST_ID" -ForegroundColor Cyan
    
    # Build the React app
    Write-Host "Building React app..." -ForegroundColor Yellow
    Push-Location $FRONTEND_DIR
    try {
        npm install
        npm run build
    } catch {
        Write-Host "React build failed." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    $BUILD_DIR = Join-Path $FRONTEND_DIR "build"
    if (-not (Test-Path $BUILD_DIR)) {
        Write-Host "Build directory not found. Build may have failed." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Write-Host "Build completed successfully!" -ForegroundColor Green
    
    # Sync to S3
    Write-Host "Syncing build files to S3..." -ForegroundColor Yellow
    aws s3 sync build/ "s3://$S3_BUCKET/" `
        --region $AWS_REGION `
        --delete `
        --cache-control "public,max-age=31536000,immutable" `
        --exclude "index.html" `
        --exclude "manifest.json"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "S3 sync failed." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    # Upload index.html and manifest.json with shorter cache
    Write-Host "Uploading index.html with shorter cache..." -ForegroundColor Yellow
    aws s3 cp build/index.html "s3://$S3_BUCKET/index.html" `
        --region $AWS_REGION `
        --cache-control "public,max-age=300,must-revalidate" `
        --content-type "text/html"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to upload index.html." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    $MANIFEST_PATH = Join-Path "build" "manifest.json"
    if (Test-Path $MANIFEST_PATH) {
        aws s3 cp build/manifest.json "s3://$S3_BUCKET/manifest.json" `
            --region $AWS_REGION `
            --cache-control "public,max-age=300,must-revalidate" `
            --content-type "application/json"
    }
    
    Pop-Location
    Write-Host "S3 sync completed!" -ForegroundColor Green
    
    # Invalidate CloudFront cache
    Write-Host "Invalidating CloudFront cache..." -ForegroundColor Yellow
    $INVALIDATION_OUTPUT = aws cloudfront create-invalidation `
        --distribution-id $CLOUDFRONT_DIST_ID `
        --paths "/*" `
        --query 'Invalidation.Id' `
        --output text
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create CloudFront invalidation." -ForegroundColor Red
        exit 1
    }
    
    $INVALIDATION_ID = $INVALIDATION_OUTPUT.Trim()
    Write-Host "CloudFront invalidation created: $INVALIDATION_ID" -ForegroundColor Cyan
    Write-Host "Waiting for invalidation to complete..." -ForegroundColor Yellow
    
    aws cloudfront wait invalidation-completed `
        --distribution-id $CLOUDFRONT_DIST_ID `
        --id $INVALIDATION_ID
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed waiting for invalidation to complete." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Frontend deployment completed!" -ForegroundColor Green
}

# Main deployment logic
try {
    switch ($Target) {
        "Backend" {
            Deploy-Backend
        }
        "Frontend" {
            Deploy-Frontend
        }
        "Both" {
            Deploy-Backend
            Deploy-Frontend
        }
    }
    
    Write-Host ""
    Write-Host "=== DEPLOYMENT COMPLETE ===" -ForegroundColor Green
    Write-Host "Application is live at: https://www.giftguru.cc" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "Deployment failed: $_" -ForegroundColor Red
    exit 1
}
