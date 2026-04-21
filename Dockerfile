FROM node:22-alpine AS builder

# Build tools needed for better-sqlite3 native addon
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runner ----
FROM node:22-alpine AS runner

# Runtime libs for better-sqlite3 compiled addon
RUN apk add --no-cache libstdc++

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/workers ./workers
COPY --from=builder /app/package.json ./

RUN mkdir -p data/mailboxes data/storage/mailboxes data/storage/attachments

EXPOSE 3000

CMD ["node_modules/.bin/tsx", "workers/server.prod.ts"]
