#!/usr/bin/env python3
"""
Debug script to test the files.upload API
"""
import sys
import os
sys.path.append('python_service')

# Import momentum_agent to initialize the client
import momentum_agent
from momentum_agent import genai_client

# Test the API signature
print(f"Client: {genai_client}")
if genai_client:
    print(f"Files object: {genai_client.files}")
    print(f"Upload method: {genai_client.files.upload}")
    
    # Try to get the signature
    import inspect
    try:
        signature = inspect.signature(genai_client.files.upload)
        print(f"API signature: {signature}")
    except Exception as e:
        print(f"Could not get signature: {e}")
        
    # Let's try to create a test file and see what parameters work
    import tempfile
    with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_file:
        temp_file.write(b'Hello, world!')
        temp_path = temp_file.name
    
    try:
        print(f"Trying to upload test file: {temp_path}")
        # Test with file parameter
        result = genai_client.files.upload(file=temp_path)
        print(f"Success with file only: {result}")
        genai_client.files.delete(name=result.name)
    except Exception as e:
        print(f"Failed with file only: {e}")
    
    try:
        print("Trying with file and config...")
        # Test with file and config
        result = genai_client.files.upload(file=temp_path, config={'mime_type': 'text/plain'})
        print(f"Success with file and config: {result}")
        genai_client.files.delete(name=result.name)
    except Exception as e:
        print(f"Failed with file and config: {e}")
        
    # Clean up
    try:
        os.unlink(temp_path)
    except:
        pass
else:
    print("No genai_client available")