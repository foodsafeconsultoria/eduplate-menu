FROM node:22-alpine

WORKDIR /app

# Keep the package manager aligned with the version declared in package.json.
RUN npm install -g pnpm@10.4.1

COPY package.json pnpm-lock.yaml* ./
COPY patches/ ./patches/

RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
