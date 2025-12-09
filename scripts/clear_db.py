import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os
import json

# Load .env manually
env_vars = {}
try:
    with open('.env', 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
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
    print("Error: MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON not found.")
    exit(1)

try:
    cred_dict = json.loads(cred_json)
    cred = credentials.Certificate(cred_dict)
except json.JSONDecodeError:
    if os.path.exists(cred_json):
            cred = credentials.Certificate(cred_json)
    else:
            print("Error: Could not parse credential JSON.")
            exit(1)

# Initialize Firebase Admin
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

def delete_collection(coll_ref, batch_size):
    docs = coll_ref.limit(batch_size).stream()
    deleted = 0

    for doc in docs:
        print(f'Deleting doc {doc.id} => {doc.to_dict()}')
        doc.reference.delete()
        deleted = deleted + 1

    if deleted >= batch_size:
        return delete_collection(coll_ref, batch_size)

collections_to_clear = ['unifiedMedia', 'collections', 'images', 'videos', 'campaigns', 'brands', 'users', 'brandMembers', 'userProfilePreferences']

print("Clearing Database...")
for coll_name in collections_to_clear:
    print(f"Clearing {coll_name}...")
    delete_collection(db.collection(coll_name), 100)

print("Database cleared.")
