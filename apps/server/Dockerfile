FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/

RUN npm ci --workspace=@fuzhou-mahjong/server --workspace=@fuzhou-mahjong/shared

COPY tsconfig.json ./
COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/

RUN npm run build --workspace=@fuzhou-mahjong/shared
RUN npm run build --workspace=@fuzhou-mahjong/server

FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/

RUN npm ci --workspace=@fuzhou-mahjong/server --workspace=@fuzhou-mahjong/shared --omit=dev

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist

EXPOSE 7701

ENV PORT=7701
CMD ["node", "apps/server/dist/index.js"]
