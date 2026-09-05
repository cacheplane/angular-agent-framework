FROM node:22-slim AS source
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /upstream
RUN git init && git remote add origin https://github.com/firecrawl/firecrawl.git \
    && git fetch --depth 1 origin 4cee46d827e1353e66228aa7f6c53734581b8f7b \
    && git checkout --detach FETCH_HEAD
COPY upstream.patch /tmp/upstream.patch
RUN git apply --check /tmp/upstream.patch && git apply /tmp/upstream.patch

FROM node:22-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true \
    PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/playwright PORT=3003
RUN corepack enable && corepack prepare pnpm@11.4.0 --activate
WORKDIR /usr/src/app
COPY --from=source /upstream/apps/playwright-service-ts/ ./
COPY --from=source /upstream/LICENSE /usr/src/app/UPSTREAM-LICENSE
RUN pnpm install --frozen-lockfile \
    && pnpm exec playwright install chromium --with-deps \
    && chmod -R a+rX /usr/local/share/playwright
COPY company-handler.cjs ./
RUN pnpm run build && cp company-handler.cjs dist/company-handler.cjs
ENV BLOCK_MEDIA=true
USER node
EXPOSE 3003
CMD ["node", "dist/api.js"]
