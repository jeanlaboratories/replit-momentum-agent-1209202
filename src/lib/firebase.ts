import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _auth: Auth | null = null;
let _googleProvider: GoogleAuthProvider | null = null;

/**
 * Check if we're in Next.js build phase (not runtime).
 * Used to return mock objects during build to allow compilation to complete.
 */
function isBuildTime(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    !!process.env.__NEXT_PRIVATE_PREBUNDLED_REACT
  );
}

if (typeof window === 'undefined') {
  // POLYFILL BROKEN LOCALSTORAGE
  // Some environments (like Replit or certain Next.js configs) might define localStorage
  // but without the expected methods (getItem, setItem, etc.), causing crashes.
  // @ts-ignore
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem !== 'function') {
    const dummyStorage = {
      getItem: () => null,
      setItem: () => { },
      removeItem: () => { },
      clear: () => { },
      length: 0,
      key: () => null,
    };

    try {
      // @ts-ignore
      global.localStorage = dummyStorage;
    } catch (e) {
      try {
        // @ts-ignore
        window.localStorage = dummyStorage;
      } catch (e2) {
        // Ignore
      }
    }
  }
}

function getFirebaseApp(): FirebaseApp {
  if (_app) {
    return _app;
  }

  const firebaseConfig = {
    // Check NEXT_PUBLIC_ first (from next.config.ts mapping), then MOMENTUM_ (for direct env access)
    // In browser, only NEXT_PUBLIC_* variables are available
    // On server, both may be available
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey) {
    if (isBuildTime()) {
      // Return a mock app during build time to allow build to complete
      // DO NOT cache it - this ensures runtime will re-check and throw proper error
      return {} as FirebaseApp;
    }
    // At runtime, throw an error if config is missing
    throw new Error('Firebase configuration is missing. NEXT_PUBLIC_FIREBASE_API_KEY (or MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY) is required.');
  }

  _app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return _app;
}

function getFirebaseDb(): Firestore {
  if (_db) {
    return _db;
  }
  const app = getFirebaseApp();

  // During build time, app might be a mock object
  if (isBuildTime() && (!app || Object.keys(app).length === 0)) {
    return {} as Firestore;
  }

  _db = getFirestore(app);
  return _db;
}

export function getStorageInstance(): FirebaseStorage {
  if (_storage) {
    return _storage;
  }
  const app = getFirebaseApp();

  // During build time, app might be a mock object
  if (isBuildTime() && (!app || Object.keys(app).length === 0)) {
    return {} as FirebaseStorage;
  }

  _storage = getStorage(app);
  return _storage;
}

function getFirebaseStorage(): FirebaseStorage {
  return getStorageInstance();
}

function getFirebaseAuth(): Auth {
  if (_auth) {
    return _auth;
  }
  const app = getFirebaseApp();

  // During build time, app might be a mock object
  if (isBuildTime() && (!app || Object.keys(app).length === 0)) {
    return {} as Auth;
  }

  _auth = getAuth(app);
  return _auth;
}

function getGoogleAuthProvider(): GoogleAuthProvider {
  if (_googleProvider) {
    return _googleProvider;
  }

  // During build time, return a mock provider
  if (isBuildTime()) {
    return {} as GoogleAuthProvider;
  }

  _googleProvider = new GoogleAuthProvider();
  // Add scopes for additional user info
  _googleProvider.addScope('profile');
  _googleProvider.addScope('email');
  return _googleProvider;
}

// Export lazy getters - only initialize when actually accessed
// This ensures build-time mocks aren't cached and runtime properly initializes
// Using Proxy to make them look like the actual objects but initialize on access
export const app = new Proxy({} as FirebaseApp, {
  get(_target, prop) {
    const actualApp = getFirebaseApp();
    const value = (actualApp as any)[prop];
    // If it's a function, bind it to the actual app
    if (typeof value === 'function') {
      return value.bind(actualApp);
    }
    return value;
  }
});

export const db = new Proxy({} as Firestore, {
  get(_target, prop) {
    const actualDb = getFirebaseDb();
    const value = (actualDb as any)[prop];
    if (typeof value === 'function') {
      return value.bind(actualDb);
    }
    return value;
  }
});

export const storage = new Proxy({} as FirebaseStorage, {
  get(_target, prop) {
    const actualStorage = getFirebaseStorage();
    const value = (actualStorage as any)[prop];
    if (typeof value === 'function') {
      return value.bind(actualStorage);
    }
    return value;
  }
});

export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const actualAuth = getFirebaseAuth();
    const value = (actualAuth as any)[prop];
    if (typeof value === 'function') {
      return value.bind(actualAuth);
    }
    return value;
  }
});

// Export a function to get the GoogleAuthProvider directly
// signInWithPopup requires the actual provider object, not a Proxy
export function getGoogleProvider(): GoogleAuthProvider {
  return getGoogleAuthProvider();
}
