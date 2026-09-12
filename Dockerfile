# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package trước để cache
COPY package*.json ./

RUN npm install

# Copy source code
COPY . .

# Build NestJS
RUN npm run build


# Stage 2: Run
FROM node:20-alpine

WORKDIR /app

# ffprobe xác minh định dạng và thời lượng video upload.
RUN apk add --no-cache ffmpeg

# Copy từ builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8001

# Run app
CMD ["node", "dist/main.js"]
