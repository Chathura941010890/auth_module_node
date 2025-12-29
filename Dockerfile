FROM node:18

WORKDIR /SMF

COPY package*.json ./

RUN npm install

COPY . . 

EXPOSE 8080

CMD ["node", "server.js"]
