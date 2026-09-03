# medical-record-service (Node.js + MongoDB Atlas)
# Contexto de build = raiz do repositorio, para copiar tambem infra/seed/patients.json:
#   docker build -f medical-record-service/Dockerfile -t medflow/medical-record-service .
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY medical-record-service/package*.json ./
RUN npm ci --omit=dev

COPY medical-record-service/src ./src
COPY infra/seed/patients.json ./infra/seed/patients.json
ENV SEED_FILE=/app/infra/seed/patients.json

EXPOSE 8083
USER node
CMD ["node", "src/server.js"]
