FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY . .

EXPOSE 5174 8787

CMD ["npm", "run", "start:api"]
