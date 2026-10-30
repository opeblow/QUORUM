# Room server image. Build from the repo root:
#   docker build -f apps/rooms/Dockerfile -t quorum-rooms .
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

# Full install + bundle (workspace packages are inlined by tsup).
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "@quorum/rooms..."
RUN pnpm --filter @quorum/rooms build

# Production-only dependencies for the bundle's external imports.
FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile --prod --filter "@quorum/rooms"

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=4000 HOST=0.0.0.0
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/rooms/node_modules ./apps/rooms/node_modules
COPY --from=build /repo/apps/rooms/dist ./apps/rooms/dist
COPY apps/rooms/package.json ./apps/rooms/package.json
WORKDIR /repo/apps/rooms
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:4000/healthz || exit 1
CMD ["node", "--enable-source-maps", "dist/main.js"]
