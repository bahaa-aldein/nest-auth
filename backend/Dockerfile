ARG NODE_VERSION=24
ARG NODE_IMAGE=node:${NODE_VERSION}-trixie-slim

FROM ${NODE_IMAGE} AS base

# Re-declare the ARG so it is in scope for this stage and its labels. The label then says
# "24", not the exact version that the Node image sets in its own NODE_VERSION variable.
ARG NODE_VERSION

LABEL org.opencontainers.image.title="backend" \
  org.opencontainers.image.authors="Bahaa Aldein" \
  org.opencontainers.image.licenses="MIT" \
  com.bahaa-aldein.node-version="${NODE_VERSION}"

ENV NODE_ENV=production

# The upgrade brings in the security fixes that the Node image does not have yet.
RUN apt-get update && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends tini \
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

USER root

RUN apt-get update && apt-get install -y --no-install-recommends procps \
  && rm -rf /var/lib/apt/lists/*

USER node

RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
  npm config list && npm ci --include=dev

WORKDIR /node/app

FROM dev AS build

COPY --chown=node:node . .

RUN npm run build

FROM build AS test

RUN npm run lint && npm test

FROM test AS audit

RUN npm audit --omit=dev --audit-level=high

FROM base AS prod

USER root

# The final image never runs npm. Removing it also removes the npm packages that scanners report.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

USER node

WORKDIR /node/app

COPY --chown=node:node --from=build /node/app/dist ./dist

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "dist/main.js"]

ARG CREATED=not-set
ARG REVISION=not-set
LABEL org.opencontainers.image.created="${CREATED}" \
  org.opencontainers.image.revision="${REVISION}"
