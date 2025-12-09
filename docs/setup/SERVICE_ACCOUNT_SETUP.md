# Service Account Setup for Vertex AI Search

## 🎯 Your Service Account Information

### Current Service Account:
```
Email: firebase-adminsdk-fbsvc@momentum-fa852.iam.gserviceaccount.com
Project: momentum-fa852
Type: Firebase Admin SDK Service Account
```

This service account is already configured in your `.env` file and is being used by MOMENTUM for Firebase operations.

---

## ✅ Action Required: Grant Discovery Engine Admin Role

### Quick Steps:

1. **Go to IAM Settings**:
   
   🔗 https://console.cloud.google.com/iam-admin/iam?project=momentum-fa852

2. **Find the Service Account**:
   
   Look for: `firebase-adminsdk-fbsvc@momentum-fa852.iam.gserviceaccount.com`

3. **Edit Permissions**:
   
   - Click the **pencil icon** (Edit) next to the service account
   - Click **"+ ADD ANOTHER ROLE"**
   
4. **Add Discovery Engine Role**:
   
   - In the "Select a role" dropdown, search for: **Discovery Engine Admin**
   - Select: `Discovery Engine Admin`
   - Click **SAVE**

5. **Verify**:
   
   The service account should now have these roles:
   - ✅ Firebase Admin SDK Administrator Service Agent
   - ✅ **Discovery Engine Admin** (newly added)

---

## 🔐 Current Roles (Likely)

Your service account probably already has:
- ✅ `Firebase Admin SDK Administrator Service Agent`
- ✅ `Storage Admin` or `Firebase Admin`
- ✅ `Vertex AI User` (for Gemini, Imagen, Veo)

### Adding:
- ➕ `Discovery Engine Admin` (for media search indexing)

---

## 🎯 Alternative: Use gcloud CLI

If you prefer command line:

```bash
# Set project
gcloud config set project momentum-fa852

# Grant Discovery Engine Admin role
gcloud projects add-iam-policy-binding momentum-fa852 \
  --member="serviceAccount:firebase-adminsdk-fbsvc@momentum-fa852.iam.gserviceaccount.com" \
  --role="roles/discoveryengine.admin"

# Verify
gcloud projects get-iam-policy momentum-fa852 \
  --flatten="bindings[].members" \
  --filter="bindings.members:firebase-adminsdk-fbsvc@momentum-fa852.iam.gserviceaccount.com"
```

---

## 📋 Complete Setup Checklist

### Prerequisites:
- [x] Service account exists: `firebase-adminsdk-fbsvc@momentum-fa852.iam.gserviceaccount.com`
- [x] Service account configured in .env
- [x] Python service using credentials
- [x] Firebase operations working

### Required Actions:
- [ ] Enable Discovery Engine API (Step 1 above)
- [ ] Grant Discovery Engine Admin role (Step 2 above)
- [ ] Wait 2-3 minutes for propagation
- [ ] Test "Index Media" in Team Companion

### Expected Result:
```
✅ Starting media index rebuild...
✅ Created data store: MOMENTUM Media - brand_xxx
✅ Indexed 15/15 media items
✅ Media indexing complete!
```

---

## 🔍 Verification Commands

### Check if API is Enabled:
```bash
gcloud services list --enabled --project=momentum-fa852 | grep discoveryengine
```

**Expected output**:
```
discoveryengine.googleapis.com  Discovery Engine API
```

### Check Service Account Roles:
```bash
gcloud projects get-iam-policy momentum-fa852 \
  --flatten="bindings[].members" \
  --filter="bindings.members:firebase-adminsdk-fbsvc@momentum-fa852.iam.gserviceaccount.com" \
  --format="table(bindings.role)"
```

**Should include**:
```
roles/discoveryengine.admin
```

---

## 🚨 Troubleshooting

### If "Index Media" Still Fails:

1. **Wait**: API enablement can take up to 5 minutes
2. **Restart Python Service**: 
   ```bash
   # Stop current servers
   lsof -ti:8000 | xargs kill -9
   # Restart
   cd python_service && ./momentum/bin/python3 main.py
   ```
3. **Check Logs**: Look for "Discovery Engine API not enabled" errors
4. **Verify Permissions**: Ensure role was added correctly

### If Permission Denied:

**Error**: `PERMISSION_DENIED`

**Solution**: The service account role wasn't applied correctly. Try:
1. Remove the role (if it exists)
2. Add it again
3. Wait 1-2 minutes
4. Try again

---

## 💡 Why This Service Account?

**This is the Firebase Admin SDK service account** that MOMENTUM uses for:
- ✅ Firestore database operations
- ✅ Firebase Storage operations  
- ✅ Firebase Authentication admin operations
- ➕ **Will also use for**: Vertex AI Search operations (after granting role)

**Benefit**: Single service account for all backend operations - simpler to manage!

---

## 🎯 Quick Reference

| Item | Value |
|------|-------|
| **Service Account Email** | `firebase-adminsdk-fbsvc@momentum-fa852.iam.gserviceaccount.com` |
| **Project ID** | `momentum-fa852` |
| **Required New Role** | `Discovery Engine Admin` |
| **API to Enable** | `discoveryengine.googleapis.com` |
| **Enable Link** | [Click here](https://console.developers.google.com/apis/api/discoveryengine.googleapis.com/overview?project=momentum-fa852) |
| **IAM Link** | [Click here](https://console.cloud.google.com/iam-admin/iam?project=momentum-fa852) |

---

## ✅ Summary

**Service Account**: `firebase-adminsdk-fbsvc@momentum-fa852.iam.gserviceaccount.com`

**Required Actions**:
1. Enable Discovery Engine API
2. Grant "Discovery Engine Admin" role to this service account
3. Wait 2-3 minutes
4. Test "Index Media"

**Time Required**: ~5 minutes  
**Cost Impact**: ~$10-30/month  
**Benefit**: Advanced semantic search for media

**The app works fine without it, but semantic search is much better!** ✨

