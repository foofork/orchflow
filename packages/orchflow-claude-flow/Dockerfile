# Multi-stage build for optimized production image
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build application
RUN NODE_ENV=production npm run build

# Remove dev dependencies
RUN npm prune --production

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    tmux \
    git \
    && addgroup -g 1001 -S orchflow \
    && adduser -S orchflow -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=orchflow:orchflow /app/dist ./dist
COPY --from=builder --chown=orchflow:orchflow /app/node_modules ./node_modules
COPY --from=builder --chown=orchflow:orchflow /app/package*.json ./

# Copy configs and docs
COPY --chown=orchflow:orchflow CLAUDE.md ./
COPY --chown=orchflow:orchflow .claude/ ./.claude/

# Create necessary directories
RUN mkdir -p /app/logs /app/data /app/.orchflow \
    && chown -R orchflow:orchflow /app

# Set environment variables
ENV NODE_ENV=production \
    ORCHFLOW_HOME=/app/.orchflow \
    ORCHFLOW_LOG_DIR=/app/logs \
    ORCHFLOW_DATA_DIR=/app/data \
    PORT=3000

# Switch to non-root user
USER orchflow

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/cli-injected.js", "start", "--ui"]

# Development stage
FROM node:18-alpine AS development

# Install dev tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    tmux \
    bash

# Set working directory
WORKDIR /app

# Copy everything
COPY . .

# Install all dependencies
RUN npm ci --legacy-peer-deps

# Set development environment
ENV NODE_ENV=development

# Expose ports
EXPOSE 3000 3001 9229

# Start in watch mode with debugging
CMD ["npm", "run", "dev"]