
import 'server-only';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * Initializes and returns the Firebase Admin SDK instances, ensuring initialization only happens once.
 * @returns An object containing the initialized adminApp, adminAuth, adminDb, and adminStorage.
 */
export function getAdminInstances() {
    try {
        const serviceAccountJson = process.env.MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON;
        
        // Only use mocks during actual Next.js build phase (not runtime)
        // Check for explicit build-time indicators
        const isBuildTime = (
            process.env.NEXT_PHASE === 'phase-production-build' ||
            process.env.__NEXT_PRIVATE_PREBUNDLED_REACT
        );
        
        if (!serviceAccountJson) {
            // During build time, return mock objects that allow build to complete
            // These will fail at runtime if actually used, but allow Next.js build to succeed
            if (isBuildTime) {
                // Return minimal mock objects that satisfy TypeScript but won't work at runtime
                return {
                    adminApp: {} as App,
                    adminAuth: {
                        verifySessionCookie: async () => ({}),
                        createSessionCookie: async () => '',
                        getUserByEmail: async () => ({}),
                    } as any,
                    adminDb: {
                        collection: () => ({
                            doc: () => ({
                                get: async () => ({ exists: false, data: () => null }),
                                set: async () => {},
                                update: async () => {},
                                collection: () => ({}),
                            }),
                            where: () => ({
                                get: async () => ({ docs: [], empty: true }),
                                limit: () => ({
                                    get: async () => ({ docs: [], empty: true }),
                                }),
                            }),
                            add: async () => ({}),
                            orderBy: () => ({
                                limit: () => ({
                                    get: async () => ({ docs: [], forEach: () => {} }),
                                }),
                            }),
                        }),
                        batch: () => ({
                            delete: () => {},
                            commit: async () => {},
                        }),
                    } as any,
                    adminStorage: {
                        bucket: () => ({
                            file: () => ({
                                save: async () => {},
                                getSignedUrl: async () => [''],
                                download: async () => [Buffer.from('')],
                                delete: async () => {},
                                exists: async () => [false],
                            }),
                        }),
                    } as any,
                };
            }
            throw new Error("The MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set. This is required for server-side actions. Please add it to your .env file.");
        }

        const serviceAccount = JSON.parse(serviceAccountJson);

        // The private_key in the JSON from a GOOGLE_APPLICATION_CREDENTIALS env var
        // often has its newlines escaped as `\n`. The Firebase Admin SDK
        // needs these to be actual newlines.
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        const bucketName = process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        if (!bucketName) {
            throw new Error("The MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set. Please add your storage bucket name to the .env file. It should look like 'project-id.appspot.com'.");
        }

        let adminApp: App;

        if (!getApps().length) {
            adminApp = initializeApp({
                credential: cert(serviceAccount),
                storageBucket: bucketName,
            });
        } else {
            // This retrieves the default app instance.
            adminApp = getApps()[0];
        }

        const adminAuth = getAuth(adminApp);
        const adminDb = getFirestore(adminApp);
        const adminStorage = getStorage(adminApp);

        return { adminApp, adminAuth, adminDb, adminStorage };

    } catch (error: any) {
        if (error instanceof SyntaxError) {
             throw new Error(`Firebase Admin SDK Initialization Error: The MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON. Please check the value in your .env file. Original error: ${error.message}`);
        }
        // Re-throw a more informative error that will be caught in the server action.
        throw new Error(`Firebase Admin SDK Initialization Error: ${error.message}`);
    }
}
