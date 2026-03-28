FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

EXPOSE 3001
ENV PORT=3001
CMD ["npm", "start"]
