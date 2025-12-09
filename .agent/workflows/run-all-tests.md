---
description: Run all tests (Python and Node.js) ensuring isolation
---

This workflow runs all tests in the project, ensuring that Python tests are run individually to avoid state leakage issues.

## Steps

1. Run Python tests individually
// turbo
for f in python_service/tests/test_*.py; do echo "Running $f"; source .venv/bin/activate && python -m pytest "$f" || exit 1; done

2. Run Node.js tests
// turbo
npm test
