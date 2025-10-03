# Azure Logs Guide - Zen Notes

This guide covers different ways to view and manage logs for your Azure deployment.

## 1. Real-time Log Streaming (Terminal)

Stream live logs to your terminal:

```bash
az webapp log tail --name zen-notes-app --resource-group zen-notes-rg
```

This is the most useful for debugging during and after deployment.

## 2. Download Recent Logs

Download all logs as a zip file:

```bash
az webapp log download \
  --name zen-notes-app \
  --resource-group zen-notes-rg \
  --log-file logs.zip
```

Then extract and view:
```bash
unzip logs.zip
```

## 3. View in Azure Portal (Browser)

Navigate to:
```
https://portal.azure.com
→ Search for "zen-notes-app"
→ Click on your app
→ Left menu: Monitoring → Log stream
```

## 4. Enable Application Logging

If logs aren't showing up, enable them:

```bash
# Enable application logging
az webapp log config \
  --name zen-notes-app \
  --resource-group zen-notes-rg \
  --application-logging filesystem \
  --level information

# Enable detailed error messages
az webapp log config \
  --name zen-notes-app \
  --resource-group zen-notes-rg \
  --detailed-error-messages true \
  --failed-request-tracing true
```

## 5. View Deployment Logs

See logs from the deployment process:

```bash
az webapp log deployment show \
  --name zen-notes-app \
  --resource-group zen-notes-rg
```

## 6. SSH into Container

For advanced debugging, SSH directly into the running container:

```bash
az webapp ssh \
  --name zen-notes-app \
  --resource-group zen-notes-rg
```

Once inside, you can:
```bash
# View running processes
ps aux

# Check Node.js version
node --version

# View environment variables
env

# Navigate to app directory
cd /home/site/wwwroot

# Check files
ls -la
```

## Quick Commands

### Check App Status
```bash
az webapp show \
  --name zen-notes-app \
  --resource-group zen-notes-rg \
  --query state
```

### Restart App
```bash
az webapp restart \
  --name zen-notes-app \
  --resource-group zen-notes-rg
```

### View Environment Variables
```bash
az webapp config appsettings list \
  --name zen-notes-app \
  --resource-group zen-notes-rg
```

### Set Environment Variable
```bash
az webapp config appsettings set \
  --name zen-notes-app \
  --resource-group zen-notes-rg \
  --settings KEY="value"
```

### Delete Environment Variable
```bash
az webapp config appsettings delete \
  --name zen-notes-app \
  --resource-group zen-notes-rg \
  --setting-names KEY
```

## Troubleshooting Tips

### "next: not found" Error
This means Azure can't find the Next.js CLI. The `startup.sh` script should handle this automatically, but if you see this error:

1. Check that `startup.sh` is included in the deployment
2. Verify the startup command is set:
   ```bash
   az webapp config show \
     --name zen-notes-app \
     --resource-group zen-notes-rg \
     --query appCommandLine
   ```
3. It should return `"startup.sh"`. If not, set it:
   ```bash
   az webapp config set \
     --name zen-notes-app \
     --resource-group zen-notes-rg \
     --startup-file "startup.sh"
   ```
4. Restart the app

### App won't start
1. Check logs: `az webapp log tail ...`
2. Verify environment variables are set
3. Check Node.js version matches your local: `package.json` engines field
4. Verify `startup.sh` has execute permissions
5. Restart the app

### 404 or 500 Errors
1. Enable detailed error messages (see #4 above)
2. Check application logs
3. Verify build succeeded (check `.next` folder was created during deployment)

### Build Issues
1. Make sure `package.json` has a `build` script
2. Verify all dependencies are in `dependencies` not `devDependencies`
3. Check Azure supports your Node.js version

### Performance Issues
1. Check app service plan tier (B1, S1, etc.)
2. Scale up if needed:
   ```bash
   az appservice plan update \
     --name zen-notes-plan \
     --resource-group zen-notes-rg \
     --sku S1
   ```

## Log Retention

By default, filesystem logs are rotated and deleted after a few days. For long-term storage:

1. Set up Application Insights
2. Configure log analytics workspace
3. Export logs to blob storage

## Useful Links

- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Next.js Deployment on Azure](https://nextjs.org/docs/deployment)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)
