#!/bin/bash
# ==============================================================================
# SME AutoPilot — One-Click Google Cloud Run Deployment Script (Bash)
# AI Riser Vietnam 2026 (#BuildwithGoogleAI)
# ==============================================================================

set -e

echo -e "\033[0;36m========================================================\033[0m"
echo -e "\033[0;32m 🚀 SME AutoPilot — Google Cloud Run Deployer (Bash)\033[0m"
echo -e "\033[0;36m========================================================\033[0m"

if ! command -v gcloud &> /dev/null; then
    echo -e "\033[0;31m❌ Error: Google Cloud SDK ('gcloud') is not installed.\033[0m"
    echo "Install gcloud from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    read -p "Enter your Google Cloud Project ID: " PROJECT_ID
    gcloud config set project "$PROJECT_ID"
fi

REGION="asia-southeast1"
SERVICE_NAME="sme-autopilot"

echo -e "\033[0;33m📌 Active Project: $PROJECT_ID | Region: $REGION\033[0m"
echo -e "\033[0;36m⚡ Deploying to Google Cloud Run...\033[0m"

gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --set-env-vars "APP_MODE=DEMO,NODE_ENV=production"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')

echo -e "\n\033[0;32m========================================================\033[0m"
echo -e "\033[0;32m 🎉 DEPLOYMENT SUCCESSFUL!\033[0m"
echo -e "\033[0;36m 🌐 Live Cloud Run URL: $SERVICE_URL\033[0m"
echo -e "\033[0;32m========================================================\033[0m"
