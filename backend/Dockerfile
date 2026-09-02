FROM node:20-bullseye-slim

WORKDIR /app

# Install native dependencies required for sharp, OCR image processing, and SQLite
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libvips-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications
COPY package*.json ./

# Install dependencies (including sharp & tesseract native bindings)
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy application source code
COPY . .

# Ensure SQLite database is created / synced at container startup
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && node server.js"]
