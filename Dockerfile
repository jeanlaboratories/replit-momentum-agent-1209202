# =============================================================================
# MOMENTUM - Multi-stage Dockerfile for Google Cloud Run
# =============================================================================
# This Dockerfile builds both Next.js frontend and Python FastAPI backend
# for deployment on Google Cloud Run
# =============================================================================

# =============================================================================
# Stage 1: Base image with Node.js and Python
# =============================================================================
FROM node:22-slim as base

# Install Python 3.11 and required system dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-dev \
    python3-pip \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && curl --version

# Create symlinks for python and pip (remove existing if present)
RUN rm -f /usr/bin/python /usr/bin/python3 && \
    ln -s /usr/bin/python3.11 /usr/bin/python && \
    ln -s /usr/bin/python3.11 /usr/bin/python3

# Set working directory
WORKDIR /app

# =============================================================================
# Stage 2: Dependencies installation
# =============================================================================
FROM base as dependencies

# Copy package files
COPY package.json package-lock.json ./
COPY python_service/requirements.txt ./python_service/

# Install Node.js dependencies
RUN npm ci --only=production

# Install Python dependencies
# Use --break-system-packages since we're in a container (isolated environment)
RUN pip3 install --no-cache-dir --break-system-packages -r python_service/requirements.txt

# =============================================================================
# Stage 3: Build Next.js application
# =============================================================================
FROM base as builder

# Copy package files
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY next.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.mjs ./
COPY components.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --legacy-peer-deps || npm ci

# Copy source code
COPY src ./src
COPY public ./public
COPY server ./server

# Copy build.env as .env for build-time use only
# This file contains ONLY NEXT_PUBLIC_* variables needed at build time
# NO SECRETS - all secrets come from Cloud Run Secret Manager at runtime
COPY build.env ./.env

# Build Next.js application
# During build, Next.js will read .env and embed NEXT_PUBLIC_* variables
RUN npm run build

# =============================================================================
# Stage 4: Production image
# =============================================================================
FROM base as production

# Install production Node.js dependencies only
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Install Python dependencies
COPY python_service/requirements.txt ./python_service/
# Use --break-system-packages since we're in a container (isolated environment)
RUN pip3 install --no-cache-dir --break-system-packages -r python_service/requirements.txt

# Copy built Next.js application from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy Python service
COPY python_service ./python_service

# NOTE: No .env file is copied to production
# All runtime secrets come from Cloud Run Secret Manager environment variables

# Copy startup script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create non-root user for security
# If UID 1000 already exists, use that user; otherwise create appuser
RUN if id -u 1000 >/dev/null 2>&1; then \
        EXISTING_USER=$(id -nu 1000); \
        echo "Using existing user with UID 1000: $EXISTING_USER"; \
        chown -R $EXISTING_USER:$EXISTING_USER /app; \
    else \
        useradd -m -u 1000 appuser 2>/dev/null || useradd -m appuser; \
        chown -R appuser:appuser /app; \
    fi

# Switch to non-root user
# Use existing user with UID 1000 if available, otherwise appuser
# Note: USER directive requires literal value, so we default to appuser
# If UID 1000 exists with different name, permissions are already set above
USER appuser

# Expose port (Cloud Run will set PORT env var, default to 8080)
EXPOSE 8080

# Health check (check Next.js health endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Start both services using entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]

