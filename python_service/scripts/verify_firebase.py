import firebase_admin
from firebase_admin import credentials, storage
import os
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

try:
    # Try to initialize with default credentials or JSON from env
    if not firebase_admin._apps:
        service_account_json = os.getenv('MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON')
        cred = None
        
        if service_account_json:
            try:
                cert_dict = json.loads(service_account_json)
                cred = credentials.Certificate(cert_dict)
                print("Initialized with MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON")
            except Exception as e:
                print(f"Failed to parse service account JSON: {e}")
        
        if not cred:
            print("Using Application Default Credentials")
            cred = credentials.ApplicationDefault()
            
        bucket_name = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')
        print(f"Using storage bucket: {bucket_name}")
        
        firebase_admin.initialize_app(cred, {
            'storageBucket': bucket_name
        })
    
    print("Firebase Admin initialized successfully.")
    
    # Try to list files or upload a dummy file to verify access
    bucket = storage.bucket()
    blob = bucket.blob("test_verify.txt")
    blob.upload_from_string("Verification test")
    print(f"Upload successful! URL: {blob.public_url}")
    
    # Clean up
    blob.delete()
    print("Cleanup successful.")
    
except Exception as e:
    print(f"Firebase verification failed: {e}")
    # Check for GOOGLE_APPLICATION_CREDENTIALS
    print(f"GOOGLE_APPLICATION_CREDENTIALS: {os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')}")
    print(f"MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON length: {len(os.getenv('MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON') or '')}")
