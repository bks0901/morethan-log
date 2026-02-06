# 1. Base 이미지 (Node.js 22 LTS 사용)
FROM node:22-alpine AS base

# 2. 의존성 설치 단계
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
# 속도 향상을 위해 캐시 활용 및 깔끔한 설치
RUN npm ci || npm install

# 3. 빌드 단계
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 타임 환경 변수 (Notion 데이터 정적 생성용)
ARG NOTION_PAGE_ID
ENV NOTION_PAGE_ID=$NOTION_PAGE_ID

# Next.js standalone 빌드 수행
RUN npm run build

# 4. 실행 단계 (Runner)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# 포트 설정 (사용자 요청에 따라 3100으로 변경)
ENV PORT 3100
ENV HOSTNAME "0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# standalone 결과물 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# 컨테이너 외부로 노출할 포트 명시
EXPOSE 3100

# server.js는 standalone 빌드 시 자동 생성됩니다.
CMD ["node", "server.js"]
