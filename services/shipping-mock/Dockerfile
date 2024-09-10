FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --omit=dev

COPY src ./src
COPY docs ./docs

ENV PORT=8004
EXPOSE 8004

CMD ["node", "src/index.js"]
