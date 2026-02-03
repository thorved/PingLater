# Build web stage
FROM node:20-alpine AS web-builder

WORKDIR /app/web

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY web/package.json ./
COPY web/package-lock.json ./
RUN npm ci

# Copy web source code
COPY web/ .

# Build the web application
RUN npm run build

# Build backend stage
FROM golang:alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Copy built web files
COPY --from=web-builder /app/web/out ./web/out

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server ./cmd/server/main.go

# Final stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates wget

# Copy the binary from builder
COPY --from=builder /app/server .

# Copy web static files
COPY --from=builder /app/web/out ./web/out

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8080

# Health check for Docker
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the server
CMD ["./server"]