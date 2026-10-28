ARG NODE_IMAGE=node:24-trixie-slim

FROM ${NODE_IMAGE} AS base

LABEL org.opencontainers.image.title="backend" \
  org.opencontainers.image.authors="Bahaa Aldein" \
  org.opencontainers.image.licenses="MIT" \
  com.bahaa-aldein.node-version="${NODE_VERSION}"

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /node/app && chown -R node:node /node

WORKDIR /node

USER node

COPY --chown=node:node package*.json .

# --omit=dev drops the dev tools. typescript would stay, because @nestjs/swagger
# lists it as an optional peer dependency (npm marks it devOptional in the
# lockfile). --omit=optional drops it too.
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
  npm config list && npm ci --omit=dev --omit=optional

ENTRYPOINT ["tini", "--"]

EXPOSE 3000

FROM base AS dev

ENV NODE_ENV=development

RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
  npm config list && npm ci --include=dev

FROM dev AS build

WORKDIR /node/app

COPY --chown=node:node . .

RUN npm run build

FROM build AS test

RUN npm run lint && npm test

FROM test AS audit

RUN npm audit --omit=dev --audit-level=high

FROM base AS prod

WORKDIR /node/app

COPY --chown=node:node --from=build /node/app/dist ./dist

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "dist/main.js"]

ARG CREATED=not-set
ARG REVISION=not-set
LABEL org.opencontainers.image.created="${CREATED}" \
  org.opencontainers.image.revision="${REVISION}"
