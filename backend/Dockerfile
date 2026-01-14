FROM oven/bun:1.1.25 AS base

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY schema.sql ./schema.sql

ENV NODE_ENV=production
EXPOSE 3001

CMD ["bun", "src/index.ts"]
