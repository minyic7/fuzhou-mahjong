FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN npm ci --workspace=@fuzhou-mahjong/web --workspace=@fuzhou-mahjong/shared

COPY tsconfig.json ./
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

RUN npm run build --workspace=@fuzhou-mahjong/shared
RUN npm run build --workspace=@fuzhou-mahjong/web

FROM nginx:alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
