import sys
import os

print("--- Python Interpreter ---")
print(sys.executable)
print("--- sys.path ---")
print(sys.path)

try:
    import google_adk
    print("\n--- SUCCESS: 'google_adk' was successfully imported. ---")
    print(f"Location: {google_adk.__file__}")
except ImportError as e:
    print(f"\n--- FAILURE: Could not import 'google_adk'. ---")
    print(f"Error: {e}")

print("\n--- Verifying site-packages contents ---")
site_packages_path = next((p for p in sys.path if 'site-packages' in p), None)
if site_packages_path and os.path.isdir(site_packages_path):
    print(f"Listing contents of: {site_packages_path}")
    try:
        contents = os.listdir(site_packages_path)
        if 'google_adk' in contents:
            print("'google_adk' directory FOUND.")
        else:
            print("'google_adk' directory NOT FOUND.")
        
        if 'google_adk-1.18.0.dist-info' in contents:
            print("'google_adk-1.18.0.dist-info' directory FOUND.")
        else:
            print("'google_adk-1.18.0.dist-info' directory NOT FOUND.")

    except Exception as e:
        print(f"Could not list directory contents: {e}")
else:
    print("Could not find site-packages directory in sys.path")
