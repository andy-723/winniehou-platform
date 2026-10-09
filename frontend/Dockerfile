FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN npm install -g yarn@1.22.22

COPY package.json ./
RUN yarn install --network-timeout 600000

COPY . .

# Empty backend URL makes the browser call same-origin /api, which nginx proxies.
ARG REACT_APP_BACKEND_URL=
ARG REACT_APP_CALENDLY_URL=
ARG REACT_APP_STRIPE_DEPOSIT_URL=
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    REACT_APP_CALENDLY_URL=$REACT_APP_CALENDLY_URL \
    REACT_APP_STRIPE_DEPOSIT_URL=$REACT_APP_STRIPE_DEPOSIT_URL \
    DISABLE_EMERGENT_OVERLAY=true \
    GENERATE_SOURCEMAP=false \
    CI=false \
    NODE_OPTIONS=--max-old-space-size=2048

RUN yarn build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
