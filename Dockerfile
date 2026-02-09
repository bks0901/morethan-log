# 1. Global ARG 선언
ARG NOTION_PAGE_ID

# 2. Base 이미지 (Node.js 22 LTS)
FROM node:22-alpine AS base

# 3. 의존성 설치 단계
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else npm install; \
  fi

# 4. 빌드 단계
FROM base AS builder
WORKDIR /app

# Global ARG 상속 및 ENV 설정
ARG NOTION_PAGE_ID
ENV NOTION_PAGE_ID=${NOTION_PAGE_ID}

RUN if [ -z "$NOTION_PAGE_ID" ]; then echo "FATAL ERROR: NOTION_PAGE_ID is not provided!"; exit 1; fi

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN echo "Building with Notion Page ID: ${NOTION_PAGE_ID}"
RUN npm run build

# 5. 실행 단계 (Runner)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME="0.0.0.0"

ARG NOTION_PAGE_ID
ENV NOTION_PAGE_ID=${NOTION_PAGE_ID}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3100

CMD ["node", "server.js"]
