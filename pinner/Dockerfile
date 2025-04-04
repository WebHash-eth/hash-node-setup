# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app
# Copy package files
COPY package*.json bun.lockb tsconfig.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy environment files if they exist
COPY .env* ./

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN bun run bundle

# Production stage
FROM node:22-slim

# Create app directory
WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nodeuser

# Set environment variables
# ENV NODE_ENV=production

# # Setup private key from build arg
# ARG PRIVATE_KEY
# ENV PRIVATE_KEY=${PRIVATE_KEY}

# Copy only necessary files from builder
COPY --from=builder --chown=nodeuser:nodejs /app/package*.json ./
COPY --from=builder --chown=nodeuser:nodejs /app/bun.lockb ./
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/.env* ./

# Switch to non-root user
USER nodeuser

# Start the application
CMD ["npm", "start"]

