# ==============================================================================
# SME AutoPilot — Multi-Stage Production Dockerfile for Google Cloud Run
# AI Riser Vietnam 2026 (#BuildwithGoogleAI)
# Target: Node.js 22 LTS Alpine | Port 8080 | <150MB Compressed Footprint
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend SPA (React 18 + Vite + Tailwind CSS)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
COPY shared/ /app/shared/
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Build Backend & Shared Types
# ------------------------------------------------------------------------------
FROM node:22-alpine AS backend-builder
WORKDIR /app

COPY package*.json tsconfig.json ./
COPY backend/package*.json ./backend/
RUN npm ci

COPY shared/ ./shared/
COPY backend/ ./backend/
RUN npm run build:backend

# ------------------------------------------------------------------------------
# Stage 3: Minimal Production Runtime (<150MB, Non-root User node, Port 8080)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV APP_MODE=DEMO

# Install production dependencies only & purge npm cache
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend, frontend assets, and seed data with proper ownership
COPY --chown=node:node --from=backend-builder /app/dist ./dist
COPY --chown=node:node --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --chown=node:node backend/src/seed ./backend/src/seed

# Enforce non-root security execution (standard Alpine node user UID 1000)
USER node

# Expose Google Cloud Run standard port
EXPOSE 8080

# Cloud Run / Container Liveness Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1

# Start production server with direct exec signal handling
CMD ["node", "dist/backend/src/server.js"]
