FROM node:20-slim

RUN apt-get update && apt-get install -y \
    mupdf-tools \
    python3 \
    python3-pip \
    && pip3 install pymupdf --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

EXPOSE 8080
CMD sh -c 'echo $GOOGLE_CREDENTIALS_BASE64 | base64 -d > /app/credentials.json && npm run start'
