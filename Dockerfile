FROM node:16-alpine

# Create app directory
WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm i

COPY . ./