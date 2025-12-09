import firebase_admin
from firebase_admin import credentials, firestore
import os

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'projectId': 'automl-migration-test',
    })

db = firestore.client()

def check_media():
    print("Checking unifiedMedia collection...")
    docs = list(db.collection('unifiedMedia').limit(10).stream())
    print(f"Found {len(docs)} documents in unifiedMedia.")
    for doc in docs:
        data = doc.to_dict()
        print(f"- {doc.id}: {data.get('type')} | {data.get('title')} | Brand: {data.get('brandId')}")

    print("\nChecking mediaCollections...")
    cols = list(db.collection('mediaCollections').limit(10).stream())
    print(f"Found {len(cols)} collections.")
    for col in cols:
        print(f"- {col.id}: {col.to_dict().get('name')}")

if __name__ == "__main__":
    check_media()
