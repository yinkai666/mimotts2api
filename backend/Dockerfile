# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Prisma requires OpenSSL at build time to detect the correct engine target.
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Prisma CLI and client require OpenSSL at runtime on Alpine.
RUN apk add --no-cache openssl

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev && npx prisma generate

# Copy built files
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 3001

# Start server
CMD ["sh", "-c", "npx prisma db push && npm run prisma:seed && node dist/index.js"]
