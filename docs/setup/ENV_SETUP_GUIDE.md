# Environment Variables Setup Guide

This guide will help you set up all the required environment variables for MOMENTUM to run locally.

## Quick Start

1. **Copy the template:**
   ```bash
   cp env.template .env
   ```

2. **Fill in the values** in `.env` using the instructions below

3. **Verify** your setup by running:
   ```bash
   npm run dev
   ```

---

## Required Variables

### 1. Firebase Client Configuration

**Where to get these:** Firebase Console → Project Settings → General → Your apps → Web app → Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Click the gear icon → Project Settings
4. Scroll to "Your apps" section
5. Click on your Web app (or create one)
6. Copy the values from the `firebaseConfig` object

**Variables to set:**
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY` - The `apiKey` value
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - The `authDomain` value
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID` - The `projectId` value
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - The `storageBucket` value
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - The `messagingSenderId` value
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID` - The `appId` value

**Example:**
```env
MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyAbc123..."
MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="my-project.firebaseapp.com"
MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID="my-project"
MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="my-project.appspot.com"
MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789"
MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abc123"
```

---

### 2. Firebase Admin Service Account

**Where to get this:** Google Cloud Console → IAM & Admin → Service Accounts

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (same as Firebase project)
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account**
5. Give it a name (e.g., "momentum-backend-service")
6. Grant these roles:
   - `Firebase Admin SDK Administrator Service Agent`
   - `Storage Admin` (for Firebase Storage)
7. Click **Done**
8. Find the service account → Click the three dots → **Manage Keys**
9. Click **Add Key** → **Create new key** → Choose **JSON**
10. Download the JSON file

**How to format for .env:**

The JSON file you downloaded looks like this:
```json
{
  "type": "service_account",
  "project_id": "my-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

**You need to convert it to a single line:**

**Option A: Using a command (recommended):**
```bash
# On macOS/Linux:
cat path/to/service-account-key.json | jq -c | sed "s/'/\\'/g" | sed 's/"/\\"/g'

# Or manually: Remove all line breaks, keep \n in private_key, wrap in single quotes
```

**Option B: Manual formatting:**
1. Open the JSON file
2. Remove all line breaks (make it one line)
3. Keep the `\n` characters in the `private_key` field (they're needed)
4. Wrap the entire JSON in single quotes `'...'`

**Example:**
```env
MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account","project_id":"my-project","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n","client_email":"momentum@my-project.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/momentum%40my-project.iam.gserviceaccount.com"}'
```

**⚠️ Important:** 
- Use **single quotes** around the JSON
- Keep `\n` in the private_key (don't convert to actual newlines)
- The entire JSON must be on one line

---

### 3. Google API Key (for AI features)

**Where to get this:** Google AI Studio

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API Key**
4. Select your project (or create a new one)
5. Copy the API key

**Variable to set:**
```env
MOMENTUM_GOOGLE_API_KEY="AIzaSyAbc123..."
```

**Note:** This key is used for:
- Gemini (text generation and vision)
- Imagen 4.0 (image generation)
- Veo 3.1 (video generation)

---

### 4. Firecrawl API Key (for website crawling)

**Where to get this:** Firecrawl Dashboard

1. Go to [Firecrawl](https://www.firecrawl.dev/)
2. Sign up for an account
3. Navigate to your dashboard
4. Copy your API key

**Variable to set:**
```env
MOMENTUM_FIRECRAWL_API_KEY="fc-abc123..."
```

**Note:** This is required for the Team Intelligence website crawling feature.

---

## Optional Variables

These have sensible defaults but can be customized:

### Site URL
```env
MOMENTUM_NEXT_PUBLIC_SITE_URL="http://localhost:5000"
```
- Used for email links and invitations
- Defaults to `http://localhost:5000` in development
- Set to your production domain when deploying

### Python Agent URL
```env
MOMENTUM_PYTHON_AGENT_URL="http://127.0.0.1:8000"
```
- URL for the Python FastAPI service (ADK agent)
- Defaults to `http://127.0.0.1:8000`
- Only change if running Python service on different host/port

### Google Cloud Project ID
```env
MOMENTUM_GOOGLE_CLOUD_PROJECT="your-project-id"
```
- Only needed if using Vertex AI instead of Google AI Studio
- Usually same as Firebase Project ID

### Replit Mail Service Token
```env
MOMENTUM_REPLIT_MAIL_SERVICE_TOKEN="..."
```
- Only needed if using Replit Mail service for sending emails
- Optional for local development

### Service Token
```env
MOMENTUM_SERVICE_TOKEN="..."
```
- Only needed in production environments
- Optional for local development

---

## Verification

After setting up your `.env` file, verify everything works:

1. **Check that the file exists:**
   ```bash
   ls -la .env
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Check for errors:**
   - If you see Firebase initialization errors, check your Firebase credentials
   - If you see "API key not configured" errors, check your Google API key
   - If website crawling fails, check your Firecrawl API key

4. **Test the application:**
   - Navigate to `http://localhost:5000`
   - Try signing up for an account
   - Test AI features (text generation, image generation)

---

## Troubleshooting

### "Firebase Admin SDK Initialization Error"
- **Problem:** `MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON` is not valid JSON
- **Solution:** 
  - Make sure the JSON is on a single line
  - Use single quotes around the JSON
  - Keep `\n` in the private_key field
  - Verify the JSON is complete (has all required fields)

### "Google API key not configured"
- **Problem:** `MOMENTUM_GOOGLE_API_KEY` is missing or invalid
- **Solution:** 
  - Get a new API key from Google AI Studio
  - Make sure it's not expired
  - Check that the key has access to Gemini, Imagen, and Veo APIs

### "Firecrawl API key not configured"
- **Problem:** `MOMENTUM_FIRECRAWL_API_KEY` is missing
- **Solution:** 
  - Sign up at Firecrawl and get your API key
  - Make sure the key is active

### "Storage bucket not found"
- **Problem:** `MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` is incorrect
- **Solution:** 
  - Check Firebase Console → Storage
  - The bucket name should be `your-project-id.appspot.com`

### Email verification not working
- **Problem:** Email links point to wrong URL
- **Solution:** 
  - Set `MOMENTUM_NEXT_PUBLIC_SITE_URL` to your actual domain
  - Make sure Firebase Authentication email templates are configured

---

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env` to git (it's in `.gitignore`)
- Never share your API keys or service account credentials
- Use different keys for development and production
- Rotate keys if they're accidentally exposed
- For production, use secure secret management (Replit Secrets, Google Secret Manager, etc.)

---

## Next Steps

Once your `.env` file is set up:

1. **Enable Firebase services:**
   - Authentication → Enable Email/Password
   - Firestore → Create database
   - Storage → Enable storage

2. **Set up Firestore security rules:**
   - Copy rules from `firestore.rules`
   - Deploy to Firebase

3. **Test the application:**
   - Sign up for an account
   - Create a team profile
   - Test AI features

4. **Read the README:**
   - See `README.md` for more setup instructions
   - Check `TECHNICAL_UNDERSTANDING.md` for architecture details

---

## Need Help?

If you encounter issues:
1. Check the error messages in the console
2. Verify all required variables are set
3. Check that API keys are valid and not expired
4. Review the troubleshooting section above
5. Check the application logs for more details

