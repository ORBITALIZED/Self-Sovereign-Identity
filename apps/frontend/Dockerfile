# ---------- build stage ----------
FROM node:20-alpine AS builder
ARG VITE_API_URL=http://localhost:8080
ARG VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
ARG VITE_EVM_CHAIN_ID=80002
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_STELLAR_HORIZON_URL=${VITE_STELLAR_HORIZON_URL} \
    VITE_EVM_CHAIN_ID=${VITE_EVM_CHAIN_ID}

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---------- runtime stage ----------
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
