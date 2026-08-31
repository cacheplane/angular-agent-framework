# ag-ui-mastra: Node hosting service for the Mastra AG-UI runtime (Lane B).
# Mirrors the ag-ui-dev deployment pattern: slim runtime image, /ok
# healthcheck via railway.json, watchdog entrypoint.
FROM node:22-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5
WORKDIR /app

# curl is needed by entrypoint.sh's watchdog.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/node_modules ./node_modules
COPY . .
RUN chmod +x entrypoint.sh

ENV NODE_ENV=production
EXPOSE 8321
CMD ["./entrypoint.sh"]
