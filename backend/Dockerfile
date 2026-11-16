# ==============================================================================
# Builder Stage: full dependency install, Prisma client generation, TS compile,
# then prune devDependencies so node_modules can be copied as-is to the runtime.
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# python3/make/g++ for native bindings (argon2); openssl so Prisma detects the
# correct engine target (linux-musl-openssl-3.0.x), matching the runtime stage.
RUN apk add --no-cache python3 make g++ openssl

# Puppeteer's bundled Chrome download is not usable on Alpine (musl) and would be
# discarded with the builder layer anyway; skip it to keep builds fast.
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install exactly what package-lock.json pins (including prisma@5.22.0 CLI).
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src/
COPY scripts ./scripts/

# Placeholder only satisfies env("DATABASE_URL") resolution at build time; no DB
# connection is made. It is scoped to this RUN and never baked into the image.
ARG BUILD_DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

# `npm run build` = `prisma generate && tsc`, using the locally installed CLI from
# node_modules/.bin (never `npx`, which could fetch an incompatible Prisma 7).
RUN DATABASE_URL="$BUILD_DATABASE_URL" npm run build

# Strip devDependencies. The generated client (node_modules/.prisma) and
# @prisma/client + prisma (runtime dependencies) are preserved.
RUN npm prune --omit=dev \
 && node -e "const { PrismaClient } = require('@prisma/client'); new PrismaClient(); console.log('Prisma client OK');" \
 && npx --no-install prisma --version

# ==============================================================================
# Production Runtime Stage: copy pre-built artifacts only; no install, no generate.
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# dumb-init for signal handling; openssl required by the Prisma query engine.
RUN apk add --no-cache dumb-init openssl

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/scripts ./scripts

RUN mkdir -p /app/storage/secure-uploads && chown -R node:node /app/storage

USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
