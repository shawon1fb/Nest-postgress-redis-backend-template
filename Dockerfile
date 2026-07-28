# Multi-stage production image for the Backend template.
#
#   docker build -t backend-template:latest .
#   docker run --env-file .env.production -p 3000:3000 backend-template:latest
#
# The app is supervised by PM2 in cluster mode. See ecosystem.config.js.

# ---------------------------------------------------------------------------
# Stage 1 — build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# bcrypt compiles from source when no prebuilt binary matches musl.
RUN apk add --no-cache python3 make g++

# Copy manifests first so dependency layers survive source-only changes.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 300000

COPY . .

# Emits to dist/src/** and copies the i18n JSON assets alongside it,
# per the `assets` entry in nest-cli.json.
RUN yarn build

# ---------------------------------------------------------------------------
# Stage 2 — production dependencies only
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --network-timeout 300000 && \
    yarn cache clean

# ---------------------------------------------------------------------------
# Stage 3 — runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS production

WORKDIR /app

# PM2 supervises the process; pm2-runtime keeps it in the foreground as PID 1
# and forwards signals, so no separate init is needed.
RUN npm install --global pm2@latest && npm cache clean --force

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --chown=nestjs:nodejs package.json ecosystem.config.js ./
# Migrations, so a release job can run drizzle against this image.
COPY --chown=nestjs:nodejs drizzle ./drizzle

ENV NODE_ENV=production \
    PORT=3000 \
    PM2_INSTANCES=max

EXPOSE 3000

USER nestjs

# GET / is the liveness route; it returns the standard success envelope.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
