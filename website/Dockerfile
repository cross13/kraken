# syntax=docker/dockerfile:1

# --- Stage 1: build the static site -----------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# playwright is a devDependency (used only by the screenshot scripts). Its
# postinstall downloads browsers we never need in the image — skip that so the
# build stays fast and doesn't fail on network/host checks.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1

# Install deps from the lockfile first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Build: tsc --noEmit && vite build -> dist/
COPY . .
RUN npm run build

# --- Stage 2: serve with nginx ----------------------------------------------
FROM nginx:alpine AS runtime

# SPA-aware server config (deep-link fallback, gzip, asset caching).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Built static assets.
COPY --from=builder /app/dist /usr/share/nginx/html

# Serve on the standard HTTP port.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
