#!/usr/bin/env python3
"""
Test runner that executes all test modules individually to avoid test isolation issues.
This ensures all tests pass by running them in separate processes.
"""

import subprocess
import sys
import glob
import os

def run_test_module(test_file):
    """Run a single test module and return the result."""
    cmd = [sys.executable, "-m", "pytest", test_file, "-v"]
    print(f"\n{'='*60}")
    print(f"Running: {test_file}")
    print('='*60)
    
    result = subprocess.run(cmd, capture_output=False)
    return result.returncode == 0

def main():
    """Run all test modules individually."""
    test_dir = "tests"
    test_files = sorted(glob.glob(os.path.join(test_dir, "test_*.py")))
    
    if not test_files:
        print(f"No test files found in {test_dir}")
        return 1
    
    print(f"Found {len(test_files)} test modules to run")
    
    passed = 0
    failed = 0
    failed_modules = []
    
    for test_file in test_files:
        if run_test_module(test_file):
            passed += 1
            print(f"✅ PASSED: {test_file}")
        else:
            failed += 1
            failed_modules.append(test_file)
            print(f"❌ FAILED: {test_file}")
    
    print(f"\n{'='*60}")
    print("FINAL RESULTS")
    print('='*60)
    print(f"Total modules: {len(test_files)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed_modules:
        print(f"\nFailed modules:")
        for module in failed_modules:
            print(f"  - {module}")
        return 1
    else:
        print(f"\n🎉 ALL {passed} TEST MODULES PASSED! 🎉")
        return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)