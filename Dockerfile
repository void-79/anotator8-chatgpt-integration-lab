# syntax=docker/dockerfile:1

# Stage 1 — Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies only (for layer caching)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ──────────────────────────────────────────────────────────

# Stage 2 — Runtime
FROM node:22-alpine

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy built artifacts and node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Switch to non-root user
USER appuser

# Environment defaults (can be overridden at runtime)
ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=8787

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8787/health || exit 1

CMD ["node", "dist/server/index.js"]
