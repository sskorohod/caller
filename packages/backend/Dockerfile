# Stage 1: Build
# Context: project root (so we can access supabase/migrations/)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy backend package files (lockfile too, so npm ci can enforce it)
COPY packages/backend/package.json packages/backend/package-lock.json ./
COPY packages/backend/tsconfig.json ./

# Install all deps (including devDeps for build). npm ci installs exactly the
# lockfile's integrity-pinned versions and fails on any mismatch — so a build
# can't silently pull a new (possibly compromised) in-range dependency version.
RUN npm ci

# Copy backend source
COPY packages/backend/src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install ffmpeg for audio conversion (MP3 → OGG Opus for Telegram voice)
RUN apk add --no-cache ffmpeg

# Install production deps
COPY packages/backend/package.json packages/backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy database migrations (needed by dist/migrate.js)
COPY supabase/migrations ./supabase/migrations

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3011

CMD ["node", "--max-old-space-size=768", "dist/server.js"]
