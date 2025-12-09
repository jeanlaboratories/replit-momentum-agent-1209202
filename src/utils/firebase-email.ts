import { z } from "zod";
import { getAdminInstances } from "@/lib/firebase/admin";

// Zod schema for email message
export const zSmtpMessage = z.object({
  to: z
    .union([z.string().email(), z.array(z.string().email())])
    .describe("Recipient email address(es)"),
  cc: z
    .union([z.string().email(), z.array(z.string().email())])
    .optional()
    .describe("CC recipient email address(es)"),
  subject: z.string().describe("Email subject"),
  text: z.string().optional().describe("Plain text body"),
  html: z.string().optional().describe("HTML body"),
  attachments: z
    .array(
      z.object({
        filename: z.string().describe("File name"),
        content: z.string().describe("Base64 encoded content"),
        contentType: z.string().optional().describe("MIME type"),
        encoding: z
          .enum(["base64", "7bit", "quoted-printable", "binary"])
          .default("base64"),
      })
    )
    .optional()
    .describe("Email attachments"),
});

export type SmtpMessage = z.infer<typeof zSmtpMessage>;

/**
 * Sends an email using Firebase Trigger Email extension
 * 
 * This function writes a document to the Firestore collection configured
 * for the Trigger Email extension, which then automatically sends the email.
 * 
 * The collection name defaults to 'mail' but can be configured via
 * FIREBASE_EMAIL_COLLECTION environment variable.
 * 
 * @param message - The email message to send
 * @returns Promise with email delivery status
 */
export async function sendEmail(message: SmtpMessage): Promise<{
  accepted: string[];
  rejected: string[];
  pending?: string[];
  messageId: string;
  response: string;
}> {
  try {
    const { adminDb } = getAdminInstances();
    
    // Get the collection name from environment variable or use default
    const collectionName = process.env.FIREBASE_EMAIL_COLLECTION || 'mail';
    
    // Normalize 'to' field - convert single email to array
    const toEmails = Array.isArray(message.to) ? message.to : [message.to];
    
    // Prepare the email document for Firestore
    // The Trigger Email extension expects this exact format:
    // {
    //   to: 'recipient@example.com',
    //   message: {
    //     subject: 'Email Subject',
    //     html: '<html>...</html>',  // or text: 'plain text'
    //   }
    // }
    const emailDoc: any = {
      to: toEmails.join(','), // Extension expects comma-separated string for multiple recipients
      message: {
        subject: message.subject,
      },
    };

    // Add message body (html takes precedence over text)
    if (message.html) {
      emailDoc.message.html = message.html;
    } else if (message.text) {
      emailDoc.message.text = message.text;
    }

    // Add optional fields if provided
    if (message.cc) {
      emailDoc.cc = Array.isArray(message.cc) ? message.cc.join(',') : message.cc;
    }

    // Attachments support (if extension version supports it)
    if (message.attachments && message.attachments.length > 0) {
      emailDoc.attachments = message.attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType || 'application/octet-stream',
        encoding: att.encoding || 'base64',
      }));
    }

    // Add document to Firestore collection
    // The Trigger Email extension will automatically process this document
    const docRef = await adminDb.collection(collectionName).add(emailDoc);
    
    console.log(`[sendEmail] Email queued in Firestore collection '${collectionName}' with ID: ${docRef.id}`);

    // Return a response that matches the expected format
    return {
      accepted: toEmails,
      rejected: [],
      pending: [],
      messageId: docRef.id,
      response: `Email queued successfully. Document ID: ${docRef.id}`,
    };
  } catch (error: any) {
    console.error('[sendEmail] Error sending email:', error);
    throw new Error(error.message || "Failed to send email via Firebase");
  }
}

