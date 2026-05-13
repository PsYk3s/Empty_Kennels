FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY web/package*.json ./web/
COPY server/package*.json ./server/
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4000 5173
CMD ["npm","run","dev"]
