import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  private storage: Storage;

  constructor() {
    this.storage = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    try {
      const objectId = randomUUID();
      const request = {
        bucket_name: "advantage-ai-documents", // Default bucket name
        object_name: `uploads/${objectId}`,
        method: "PUT",
        expires_at: new Date(Date.now() + 900 * 1000).toISOString(), // 15 minutes
      };

      const response = await fetch(
        `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to sign object URL, errorcode: ${response.status}`
        );
      }

      const { signed_url: signedURL } = await response.json();
      return signedURL;
    } catch (error) {
      console.error("Error getting upload URL:", error);
      throw new Error("Failed to get upload URL");
    }
  }
}