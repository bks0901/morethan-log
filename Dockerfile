# 1. Base 이미지 (Node.js 22 LTS)
FROM node:22-alpine AS base

# 2. 의존성 설치 단계
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 패키지 매니저 파일들 복사
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# 프로젝트에 맞는 패키지 매니저 자동 선택 및 설치
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else npm install; \
  fi

# 3. 빌드 단계
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 타임 환경 변수
ARG NOTION_PAGE_ID
ENV NOTION_PAGE_ID=${NOTION_PAGE_ID}

RUN npm run build

# 4. 실행 단계 (Runner)
FROM base AS runner
WORKDIR /app

# 문법 경고 해결: ENV KEY=VALUE 형식 사용
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3100

CMD ["node", "server.js"]
