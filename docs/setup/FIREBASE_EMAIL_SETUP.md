# Firebase Trigger Email Extension Setup

This guide explains how to set up the Firebase Trigger Email extension to send emails in MOMENTUM.

## Overview

MOMENTUM now uses the **Firebase Trigger Email** extension instead of Replit Mail API. This extension automatically sends emails when documents are added to a Firestore collection.

## Installation Steps

### 1. Install the Trigger Email Extension

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (momentum-fa852)
3. Navigate to **Extensions** in the left sidebar
4. Click **Browse all extensions** or search for "Trigger Email"
5. Click on **Trigger Email** extension
6. Click **Install**

### 2. Configure the Extension

During installation, you'll be prompted to configure:

- **Collection path**: The Firestore collection to monitor (default: `mail`)
- **Location/Region**: **IMPORTANT** - Set this to match your Firestore database region
  - Your Firestore is in region: `nam7`
  - **Set the extension location to `nam7`** (not us-central1)
  - This ensures Cloud Functions deploy in the same region as Firestore
- **Email service provider**: Choose one:
  - **MailerSend** (recommended) - Free tier: 12,000 emails/month
  - **SendGrid** - Free tier: 100 emails/day
  - **Mailgun** - Free tier: 5,000 emails/month
  - **SMTP** - Use your own SMTP server

### 3. Set Up Email Service Provider

#### Option A: MailerSend (Recommended)

1. Sign up at [MailerSend](https://www.mailersend.com/)
2. Verify your domain or use their sandbox domain for testing
3. Get your API key from Settings → API Tokens
4. Enter the API key during extension installation

#### Option B: SendGrid

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Create an API key with "Mail Send" permissions
3. Enter the API key during extension installation

#### Option C: SMTP

1. Use your own SMTP server credentials
2. Enter SMTP configuration during extension installation

### 4. Configure Collection Name (Optional)

If you used a custom collection name (not `mail`), set it in your environment:

```env
FIREBASE_EMAIL_COLLECTION="your-custom-collection-name"
```

## How It Works

1. **Application Code**: Calls `sendEmail()` function
2. **Firestore Write**: Function writes email data to the configured collection
3. **Extension Trigger**: Extension detects new document
4. **Email Sent**: Extension sends email via configured provider
5. **Status Update**: Extension updates document with delivery status

## Email Document Structure

The extension expects documents with this structure:

```typescript
{
  to: "user@example.com",           // Required: Recipient email(s), comma-separated
  message: {
    subject: "Email Subject",       // Required: Email subject
    text: "Plain text body",        // Optional: Plain text version
    html: "<html>...</html>",       // Optional: HTML version
  },
  cc: "cc@example.com",             // Optional: CC recipients
  attachments: [...],                // Optional: Email attachments
}
```

## Testing

1. **Test Email Sending**:
   ```typescript
   import { sendEmail } from '@/utils/firebase-email';
   
   await sendEmail({
     to: 'test@example.com',
     subject: 'Test Email',
     html: '<h1>Hello!</h1>',
     text: 'Hello!',
   });
   ```

2. **Check Firestore**: Go to Firestore console and check the `mail` collection
3. **Check Extension Logs**: Go to Extensions → Trigger Email → View logs

## Troubleshooting

### Emails Not Sending

1. **Check Extension Status**: 
   - Go to Extensions → Trigger Email
   - Ensure extension is enabled and running

2. **Check Firestore Collection**:
   - Verify documents are being created in the collection
   - Check document structure matches expected format

3. **Check Extension Logs**:
   - View logs in Firebase Console
   - Look for error messages

4. **Verify Email Provider**:
   - Check API key is valid
   - Verify domain is verified (if required)
   - Check provider's sending limits

### Common Issues

- **"Collection not found"**: Ensure collection name matches configuration
- **"Invalid email format"**: Check email addresses are valid
- **"Provider authentication failed"**: Verify API key is correct
- **"Rate limit exceeded"**: Check provider's sending limits

## Migration from Replit Mail

The code has been updated to use `firebase-email.ts` instead of `replitmail.ts`. No code changes are needed in your application - the `sendEmail()` function signature remains the same.

## Cost Considerations

- **Firebase Extensions**: Free to install
- **Firestore Writes**: Minimal cost (pay-per-use)
- **Email Provider**: Varies by provider:
  - MailerSend: Free tier (12K emails/month)
  - SendGrid: Free tier (100 emails/day)
  - Mailgun: Free tier (5K emails/month)

## Next Steps

1. Install the Trigger Email extension
2. Configure your email service provider
3. Test email sending
4. Monitor extension logs for any issues

For more information, see the [Firebase Trigger Email documentation](https://firebase.google.com/docs/extensions/official/firestore-send-email).

