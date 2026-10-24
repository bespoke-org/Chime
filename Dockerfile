# Build stage: installs the dependencies (the postinstall step generates the
# Prisma client) and builds the Next.js app. Runtime stage: Node 22 with the
# bun binary and the built tree, node_modules included, so the same image runs
# `prisma migrate deploy` (the migrate service in compose.prod.yaml) and
# `bun run uploads:cleanup`.
FROM node:22-bookworm-slim AS build
COPY --from=oven/bun:1.3.13 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
# prisma.config.ts reads DATABASE_URL when it loads; generate does not connect.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    NEXT_TELEMETRY_DISABLED=1
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:22-bookworm-slim AS runtime
COPY --from=oven/bun:1.3.13 /usr/local/bin/bun /usr/local/bin/bun
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["bun", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
