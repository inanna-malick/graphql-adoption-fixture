FROM node:20-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY openapi.yaml ./

ENV DATABASE_URL="file:/app/data/orders.db"
ENV PORT=8001
EXPOSE 8001

CMD ["sh", "-c", "mkdir -p /app/data && npx prisma migrate deploy && node src/index.js"]
