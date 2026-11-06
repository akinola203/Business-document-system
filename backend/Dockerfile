# ==============================================================================
# Builder Stage: Install dependencies, generate Prisma client, compile TypeScript
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies required for building native bindings if any
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY tsconfig*.json ./
COPY src ./src/
COPY scripts ./scripts/

RUN npx prisma generate
RUN npm run build

# ==============================================================================
# Production Runtime Stage: Minimal image with production dependencies & non-root user
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install dumb-init for proper signal handling and process management
RUN apk add --no-cache dumb-init

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production && npx prisma generate

# Copy compiled JavaScript output from builder stage
COPY --from=builder /app/dist ./dist

# Create local storage directory and set directory permissions for non-root user
RUN mkdir -p /app/storage/secure-uploads && chown -R node:node /app

USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
