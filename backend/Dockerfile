FROM oven/bun:1.1.30 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --production

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules /app/node_modules
COPY src ./src
COPY package.json ./package.json
CMD ["bun", "src/index.ts"]
