import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os
import json

# Load .env manually since python-dotenv might not be installed or we want to be simple
env_vars = {}
try:
    with open('.env', 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                # Handle quoted values
                if value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                elif value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                env_vars[key] = value
except Exception as e:
    print(f"Warning: Could not load .env file: {e}")

# Get credentials
cred_json = env_vars.get('MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON') or os.environ.get('MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON')

if not cred_json:
    print("Error: MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON not found in .env or environment.")
    # Try Application Default Credentials as fallback
    cred = credentials.ApplicationDefault()
else:
    try:
        # Handle potential escaped newlines if read from file raw
        cred_dict = json.loads(cred_json)
        cred = credentials.Certificate(cred_dict)
    except json.JSONDecodeError:
        # Maybe it's a path?
        if os.path.exists(cred_json):
             cred = credentials.Certificate(cred_json)
        else:
             print("Error: Could not parse credential JSON.")
             exit(1)

# Initialize Firebase Admin
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

def count_collection(collection_name):
    try:
        docs = db.collection(collection_name).stream()
        count = sum(1 for _ in docs)
        print(f"Collection '{collection_name}': {count} documents")
        return count
    except Exception as e:
        print(f"Error counting collection '{collection_name}': {e}")
        return 0

print("Verifying Database Counts...")
images_count = count_collection('images')
videos_count = count_collection('videos')
unified_media_count = count_collection('unifiedMedia')
collections_count = count_collection('collections')

print(f"\nSummary:")
print(f"Images: {images_count}")
print(f"Videos: {videos_count}")
print(f"Unified Media: {unified_media_count}")
print(f"Collections: {collections_count}")

if unified_media_count >= images_count + videos_count:
    print("\nSUCCESS: unifiedMedia count is consistent with images + videos.")
else:
    print("\nWARNING: unifiedMedia count is LESS than images + videos. Seed might be incomplete.")

if collections_count > 0:
    print("SUCCESS: collections are populated.")
else:
    print("WARNING: collections are EMPTY.")
