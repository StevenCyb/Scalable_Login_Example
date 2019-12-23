FROM node:10

WORKDIR /usr/src/app

COPY package*.json ./
COPY html/*.* ./

RUN npm install
COPY . .

EXPOSE 3000
CMD ["node", "app.js"]
