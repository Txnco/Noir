FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
# Copy all package.json files to allow for workspace resolution
COPY apps/web/package.json ./apps/web/
# If there are other packages, they should be copied here too

RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build from the root to let Turborepo/Next.js handle monorepo paths
ENV NEXT_TELEMETRY_DISABLED 1

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build -- --filter=web

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# In monorepo standalone mode, Next.js puts everything in .next/standalone
# The structure inside is:
# .next/standalone/
# ├── node_modules/
# ├── package.json
# └── apps/
#     └── web/
#         ├── server.js
#         └── .next/

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

# For monorepos, you must run the server.js located inside the app folder
CMD ["node", "apps/web/server.js"]
