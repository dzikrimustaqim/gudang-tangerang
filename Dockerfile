# Multi-stage Dockerfile for Warehouse Management System

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm@8.10.0

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build frontend
RUN pnpm run build

# Stage 2: Backend Production
FROM node:20-alpine AS backend

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.10.0

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --prod

# Copy backend server
COPY server-db.cjs ./server.cjs

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.cjs"]

# Note: Stage 3 (web/nginx) removed - using direct nginx image in docker-compose.yml
