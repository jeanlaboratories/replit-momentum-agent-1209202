---
description: Safely verify the build without breaking the running dev server
---

# Safe Build Verification

This workflow allows you to verify that the application builds correctly without interrupting or corrupting the running development server. It does this by using a separate build directory.

1. Create a temporary directory for the build verification
// turbo
2. Copy the project files to the temporary directory (excluding node_modules and .next to save time, we'll symlink node_modules)
3. Symlink node_modules from the main project
4. Run the build in the temporary directory
5. Clean up

## Step-by-step Instructions

Run the following command to perform a safe build verification:

```bash
# Create a temp dir
mkdir -p ../momentum-agent-build-verify

# Copy source files (using rsync for speed and exclusion)
rsync -av --progress . ../momentum-agent-build-verify --exclude node_modules --exclude .next --exclude .git

# Symlink node_modules
ln -sf $(pwd)/node_modules ../momentum-agent-build-verify/node_modules

# Run build in the temp dir
cd ../momentum-agent-build-verify
npm run build
```

## Alternative: Stop Dev Server First

If you prefer to build in the main directory, you **MUST** stop the dev server first.

1. Stop the running `npm run dev` process (Ctrl+C).
2. Run `npm run build`.
3. Restart `npm run dev`.
