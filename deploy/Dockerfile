FROM oven/bun:1.4.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/bot/package.json apps/bot/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY tests/api/package.json tests/api/package.json
COPY tests/core/package.json tests/core/package.json
RUN bun install --frozen-lockfile

FROM deps AS web
COPY . .
RUN bun run --filter '@maiq/web' build && bun deploy/csp.ts apps/web/build /app/csp.conf

FROM deps AS runtime-deps
RUN rm -rf node_modules \
    && bun install --frozen-lockfile --production --linker=hoisted --filter '@maiq/api'

FROM oven/bun:1.4.2-alpine
RUN apk add --no-cache nginx supervisor
WORKDIR /app
ENV NODE_ENV=production \
    MAIQ_CONFIG_DIR=/app/maiq.d \
    BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
COPY --from=runtime-deps /app/node_modules node_modules
COPY package.json bunfig.toml ./
COPY packages packages
COPY apps/api apps/api
COPY apps/bot apps/bot
COPY --from=web /app/apps/web/build /srv/www
COPY --from=web /app/csp.conf /etc/nginx/snippets/csp.conf
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/supervisord.conf /etc/supervisord.conf
COPY --chmod=0755 deploy/exit-on-fatal.sh /usr/local/bin/exit-on-fatal
USER bun
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO /dev/null http://127.0.0.1:8080/api/readyz || exit 1
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
