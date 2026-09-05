FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# tickets.ts читает шрифты/картинку куклы из src/assets в рантайме (генерация
# PDF-билета — за запрос, её нельзя выполнить на этапе сборки), поэтому этой
# папке нужно физически быть и в финальном образе, не только в build-стадии.
COPY --from=build /app/src/assets ./src/assets
RUN chown -R node:node /app

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8080/ || exit 1
USER node
CMD ["node", "dist/server/entry.mjs"]
