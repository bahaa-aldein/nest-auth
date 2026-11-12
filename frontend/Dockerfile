ARG NODE_VERSION=24
ARG NODE_IMAGE=node:${NODE_VERSION}-trixie-slim
ARG NGINX_IMAGE=nginx:1.30-alpine

FROM ${NODE_IMAGE} AS dev

RUN mkdir -p /node/app/node_modules && chown -R node:node /node

WORKDIR /node

USER node

COPY --chown=node:node package*.json .

RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
  npm config list && npm ci

WORKDIR /node/app

FROM dev AS build

COPY --chown=node:node . .

# VITE_API_URL is baked into the JavaScript bundle at build time: Vite writes the
# value into the files, so `docker run -e` cannot change it later. For the
# production stack build with --build-arg VITE_API_URL=/api (the API on the same
# origin, behind a proxy).
#
# One image per API address: an image built for /api works only behind a proxy
# that serves /api. Two ways around it: always use the relative /api and let each
# environment's proxy route it, or load the address at runtime from a config file
# that the container writes when it starts (this needs a change in src/lib/config.ts).
#
# The default is the development address, the same fallback as the code. If you
# forget the build argument, a production image silently calls localhost:3000,
# which a user's browser cannot reach. Always pass the argument for production.
ARG VITE_API_URL=http://localhost:3000

RUN npm run build

FROM build AS test

RUN npm run lint && npm test

FROM ${NGINX_IMAGE} AS prod

# The nginx base image can lag behind Alpine's security fixes. Upgrade libxslt
# (CVE-2026-125350, fixed in 1.1.43-r4) so the Trivy scan in CI passes.
# Remove this line once the base image ships the fixed version.
RUN apk upgrade --no-cache libxslt

# Re-declare the ARG so it is in scope for this stage and its labels
ARG NODE_VERSION
LABEL org.opencontainers.image.title="frontend" \
  org.opencontainers.image.authors="Bahaa Aldein" \
  org.opencontainers.image.licenses="MIT" \
  com.bahaa-aldein.node-version="${NODE_VERSION}"

COPY --from=build /node/app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

ARG CREATED=not-set
ARG REVISION=not-set
LABEL org.opencontainers.image.created="${CREATED}" \
  org.opencontainers.image.revision="${REVISION}"
