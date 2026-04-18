FROM node:20-slim

RUN apt-get update && apt-get install -y \
    mupdf-tools \
    python3 \
    python3-pip \
    ghostscript \
    && pip3 install pymupdf --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

EXPOSE 8080
CMD ["npm", "run", "start"]
