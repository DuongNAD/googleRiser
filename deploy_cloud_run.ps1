# ==============================================================================
# SME AutoPilot — One-Click Google Cloud Run Deployment Script (PowerShell)
# AI Riser Vietnam 2026 (#BuildwithGoogleAI)
# ==============================================================================

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " 🚀 SME AutoPilot — Google Cloud Run Deployer (PowerShell)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Check prerequisites
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Google Cloud SDK ('gcloud') is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install gcloud from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

$PROJECT_ID = gcloud config get-value project 2>$null
if (-not $PROJECT_ID -or $PROJECT_ID -eq "(unset)") {
    $PROJECT_ID = Read-Host "Enter your Google Cloud Project ID"
    gcloud config set project $PROJECT_ID
}

Write-Host "📌 Active Google Cloud Project: $PROJECT_ID" -ForegroundColor Yellow

$REGION = "asia-southeast1"
$SERVICE_NAME = "sme-autopilot"

Write-Host "⚡ Building container and deploying directly to Cloud Run..." -ForegroundColor Cyan

# 2. Deploy source directly using Google Cloud Run Source-to-Image
gcloud run deploy $SERVICE_NAME `
    --source . `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --port 8080 `
    --memory 512Mi `
    --cpu 1 `
    --set-env-vars "APP_MODE=DEMO,NODE_ENV=production"

if ($LASTEXITCODE -eq 0) {
    $SERVICE_URL = gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host " 🎉 DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host " 🌐 Live Cloud Run URL: $SERVICE_URL" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Green
} else {
    Write-Host "`n❌ Deployment failed. Please check your Google Cloud quota or permissions." -ForegroundColor Red
}
