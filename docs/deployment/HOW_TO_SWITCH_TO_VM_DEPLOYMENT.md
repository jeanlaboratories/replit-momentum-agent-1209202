# How to Switch to Reserved VM Deployment

## ⚠️ IMPORTANT: Manual Step Required

The `.replit` configuration has been updated to VM deployment, but **Replit requires you to manually change the deployment type in the UI**. The configuration file alone is not enough.

## Step-by-Step Instructions

### Step 1: Access Deployment Settings

1. Click on the **"Deployments"** tab (or **"Publishing"**) in your Replit workspace
2. If you have an existing deployment, click on it to view details
3. Look for **"Configuration"** or **"Settings"** tab

### Step 2: Change Deployment Type

1. Find the **"Deployment Type"** or **"Change deployment type"** option
2. Click on it to see available options
3. Select **"Reserved VM - Web Server"** (NOT "Reserved VM - Background Worker")
4. Confirm the change

### Step 3: Configure VM Settings

When setting up Reserved VM:

**App Type**: Select **"Web Server"** (important!)

**Build Command**: 
```bash
npm run build
```

**Run Command**: 
```bash
bash start-services.sh
```

**Port**: `5000` (should be auto-detected)

**Machine Size**: 
- Start with the smallest size (0.5 vCPU, 1 GB RAM)
- Can upgrade later if needed

### Step 4: Deploy

1. Save the configuration
2. Click **"Deploy"** button
3. Wait for deployment to complete (2-5 minutes)
4. Monitor deployment logs for startup messages

## Why This Manual Step is Required

Replit's deployment system requires explicit selection of the deployment type through the UI because:

1. **Billing Impact**: VM deployments have different pricing than Autoscale
2. **Resource Allocation**: VMs require dedicated resources to be provisioned
3. **Configuration Validation**: UI ensures all VM-specific settings are properly configured

## Expected Deployment Output

Once deployed with VM, you should see in the logs:

```
=== AdVantage Production Startup ===
Starting services for VM deployment...

[1/2] Starting Python FastAPI service...
Python service started (PID: XXXX)
Waiting for Python service to be ready on localhost:8000...
✓ Python service is ready!

[2/2] Starting Next.js server...
Next.js started (PID: XXXX)

=== All services started ===
Python FastAPI: http://127.0.0.1:8000 (internal only)
Next.js: http://0.0.0.0:5000 (external)
```

## Verification Checklist

After deployment completes:

- [ ] Deployment shows "Running" status (green)
- [ ] Visit your production URL - site loads correctly
- [ ] Check Python Backend Service - should show "✅ Available"
- [ ] Test Marketing Agent features - should work
- [ ] No "Service Unavailable" errors

## Current Configuration Status

✅ **`.replit` file**: Configured for VM deployment  
✅ **`start-services.sh`**: Ready to start both services  
✅ **`package.json`**: Start command configured  
✅ **Port configuration**: Set to 5000  
✅ **Python service**: Configured for localhost:8000  
✅ **Health check endpoint**: `/api/health` available  

**Missing**: Manual UI deployment type change (YOUR ACTION REQUIRED)

## Troubleshooting

### If You Can't Find "Reserved VM" Option

Some Replit accounts may have restrictions:
- Check if your account has access to Reserved VM deployments
- May require a paid Replit plan
- Contact Replit support if option is not visible

### If Deployment Still Fails

1. **Check deployment logs** for specific errors
2. **Verify environment variables** are set (GOOGLE_API_KEY, Firebase vars)
3. **Test locally first**: Run `npm run build && npm run start`
4. **Check Replit status page** for platform issues

### Alternative: Static Deployment (Not Recommended)

If Reserved VM is not available:
- Python service will NOT work in production
- Only Next.js will run
- Marketing Agent features will be disabled
- Not recommended for this application

## Cost Considerations

**Reserved VM Pricing**:
- Always-running (no scale-to-zero)
- Predictable monthly cost
- Required for this application's architecture

**vs Autoscale**:
- Scales to zero when idle (lower cost for low-traffic)
- Cannot run Python service (NOT compatible)

## Summary

🔧 **Configuration**: Already done (files updated)  
👤 **Your Action**: Change deployment type to Reserved VM in UI  
⏱️ **Time Required**: 2-3 minutes  
✅ **Result**: Python service will work in production  

---

**Next Step**: Go to Deployments → Change deployment type → Select "Reserved VM - Web Server" → Deploy
