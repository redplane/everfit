# syntax=docker/dockerfile:1

# ---- Build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /workspace

# Enable the pinned pnpm via corepack.
RUN corepack enable

# Install dependencies first (better layer caching).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest of the workspace and build the api app.
COPY . .
RUN pnpm nx build api

# ---- Runtime stage ---------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

# Install only production dependencies for a slim image.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy the compiled application from the build stage.
COPY --from=build /workspace/dist/apps/api ./

EXPOSE 3000
CMD ["node", "main.js"]
