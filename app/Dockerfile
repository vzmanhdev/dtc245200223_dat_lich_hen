FROM node:24-alpine3.23@sha256:47019ffab12a48f49795a8279603f87e91a64de017fb9aa874e64f489b686079 AS dependencies
RUN apk upgrade --no-cache
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Runtime contains Node and production dependencies, not build-time npm/Yarn.
# Keep the Alpine package database so scanners can identify installed OS packages.
FROM alpine:3.23@sha256:3d67941fed5ae436b2bb9791cb3f50a252441c7706bbc5b4e738936df8ff8306
RUN apk upgrade --no-cache && apk add --no-cache libstdc++ \
    && addgroup -g 1000 node && adduser -u 1000 -G node -D node
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
ENV NODE_ENV=production PORT=3000 LOG_DIR=/var/log/appointment
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY --chown=node:node app ./app
RUN mkdir -p /var/log/appointment && chown node:node /var/log/appointment
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","app/server.js"]
