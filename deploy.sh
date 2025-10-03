#!/bin/bash
# Deployment script for Zen Notes to Azure App Service

set -e  # Exit on error

# Configuration
RESOURCE_GROUP="${RESOURCE_GROUP:-zen-notes-rg}"
APP_NAME="${APP_NAME:-zen-notes-app}"
DEPLOYMENT_FILE="deploy.zip"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo "Zen Notes - Azure Deployment"
echo "============================================================"
echo "Resource Group: $RESOURCE_GROUP"
echo "App Name: $APP_NAME"
echo "============================================================"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed${NC}"
    echo "Install from: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
echo -e "${YELLOW}Checking Azure login status...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${RED}Not logged in to Azure${NC}"
    echo "Please run: az login"
    exit 1
fi

ACCOUNT=$(az account show --query name -o tsv)
echo -e "${GREEN}✓ Logged in as: $ACCOUNT${NC}"
echo ""

# Clean up old deployment file
if [ -f "$DEPLOYMENT_FILE" ]; then
    echo -e "${YELLOW}Removing old deployment package...${NC}"
    rm "$DEPLOYMENT_FILE"
fi

# Ensure a fresh local build exists (standalone)
echo -e "${YELLOW}Installing dependencies and building locally...${NC}"
npm ci
npm run build

# Create deployment package with only runtime artifacts
echo -e "${YELLOW}Creating minimal deployment package (standalone)...${NC}"
zip -r "$DEPLOYMENT_FILE" \
  .next/standalone \
  .next/static \
  public \
  startup.sh \
  package.json \
  -x "*.DS_Store"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo -e "${RED}Error: Failed to create deployment package${NC}"
    exit 1
fi

FILE_SIZE=$(du -h "$DEPLOYMENT_FILE" | cut -f1)
echo -e "${GREEN}✓ Deployment package created: $DEPLOYMENT_FILE ($FILE_SIZE)${NC}"
echo ""

# Check if app exists
echo -e "${YELLOW}Checking if app exists...${NC}"
if ! az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo -e "${RED}Error: App '$APP_NAME' not found in resource group '$RESOURCE_GROUP'${NC}"
    echo "Please create the app first or check your configuration."
    exit 1
fi
echo -e "${GREEN}✓ App exists${NC}"
echo ""

# Deploy to Azure
echo -e "${YELLOW}Deploying to Azure...${NC}"
echo "This may take a few minutes..."
az webapp deployment source config-zip \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --src "$DEPLOYMENT_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Deployment uploaded successfully${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi
echo ""

# Wait for deployment to complete
echo -e "${YELLOW}Waiting for deployment to complete...${NC}"
sleep 5
echo ""

# Configure startup command
echo -e "${YELLOW}Configuring startup command...${NC}"
az webapp config set \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --startup-file "startup.sh"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Startup command configured${NC}"
else
    echo -e "${RED}✗ Failed to configure startup command${NC}"
fi
echo ""

# Restart the app
echo -e "${YELLOW}Restarting app...${NC}"
az webapp restart \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ App restarted${NC}"
else
    echo -e "${RED}✗ Restart failed${NC}"
    exit 1
fi
echo ""

# Get app URL
APP_URL=$(az webapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query defaultHostName -o tsv)

echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""
echo "============================================================"
echo "App URL: https://$APP_URL"
echo "============================================================"
echo ""

# Wait for app to start
echo -e "${YELLOW}Waiting for app to start (30 seconds)...${NC}"
sleep 30

# Test the deployment
echo -e "${YELLOW}Testing deployment...${NC}"
echo ""

# Test: Root endpoint
echo "Test: Root endpoint"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$APP_URL/")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
    echo -e "${GREEN}✓ App is running: OK ($HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ App check: FAIL ($HTTP_CODE)${NC}"
fi

echo ""
echo "============================================================"
echo "Next Steps:"
echo "============================================================"
echo ""
echo "1. Set environment variables (if not already set):"
echo "   az webapp config appsettings set \\"
echo "     --resource-group $RESOURCE_GROUP \\"
echo "     --name $APP_NAME \\"
echo "     --settings \\"
echo "       OPENAI_API_KEY=\"sk-your-openai-key\""
echo ""
echo "2. View your app:"
echo "   https://$APP_URL"
echo ""
echo "3. Monitor logs:"
echo "   az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
echo ""
echo "4. View logs in Azure Portal:"
echo "   https://portal.azure.com/#@/resource/subscriptions/YOUR_SUB/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$APP_NAME/logStream"
echo ""
echo "============================================================"
echo ""

# Clean up
echo -e "${YELLOW}Cleaning up...${NC}"
rm "$DEPLOYMENT_FILE"
echo -e "${GREEN}✓ Deployment package removed${NC}"
echo ""

echo -e "${GREEN}Deployment script completed successfully!${NC}"
