# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
# npm ci, then force-install the rolldown native binding. npm's optional-dep
# resolver (npm/cli#4828) drops the transitive linux binding, so we install it
# explicitly at the top level on the actual linux/x64 builder.
RUN npm ci \
 && npm install @rolldown/binding-linux-x64-gnu@1.1.5 --no-save --force --os=linux --cpu=x64

COPY . .
RUN npm run build

# ---- runtime stage ----
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
