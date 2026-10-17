FROM node:22.23.3-alpine3.21

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .

ENV PORT=4173
EXPOSE 4173

CMD ["npm", "run", "start"]
