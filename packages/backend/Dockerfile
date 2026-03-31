# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all deps (including devDeps for build)
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package.json and install production deps only
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

CMD ["node", "dist/server.js"]
