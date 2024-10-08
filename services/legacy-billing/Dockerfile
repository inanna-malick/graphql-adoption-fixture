FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --omit=dev

COPY proto ./proto
COPY src ./src

ENV PORT=50051
EXPOSE 50051

CMD ["node", "src/server.js"]
