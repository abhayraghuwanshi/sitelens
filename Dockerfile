# SiteLens Studio, hosted (server/hosted.mjs). Fly builds this; see docs/hosting.md.

FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM node:26-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
# The home page lists the free course from the same file the course pages are built from.
COPY tools/course.mjs ./tools/course.mjs
COPY --from=build /app/web/dist ./web/dist
# Fly mounts the volume as root; hand it to the unprivileged node user, then drop to it.
CMD ["sh", "-c", "chown -R node:node /data && chmod 700 /data && exec setpriv --reuid=node --regid=node --init-groups node --no-warnings=ExperimentalWarning server/hosted.mjs"]
