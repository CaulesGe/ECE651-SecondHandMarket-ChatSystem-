# Multi-stage build for ECE651-G11 Secondhand Hub

# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install dependencies
RUN npm ci

# Copy client source code
COPY client/ ./

# Build the production bundle
RUN npm run build

# Stage 2: Setup the backend and final image
FROM node:20-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy backend package files
COPY backend/package*.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --omit=dev

# Install Prisma CLI for generate and db push
RUN npm install prisma --save-dev

# Copy backend source code
COPY backend/ ./

# Set DATABASE_URL for Prisma generate
ENV DATABASE_URL="file:/app/database/secondhand.db"

# Copy Prisma schema and generate client
RUN npx prisma generate

# Copy the built frontend from stage 1
COPY --from=frontend-builder /app/client/dist /app/client/dist

# Create database directory
RUN mkdir -p /app/database

# Expose port 3000
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start script: initialize database and start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
