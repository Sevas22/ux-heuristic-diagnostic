FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
# El postinstall del package.json corre "playwright install --with-deps chromium", que además de
# descargar el navegador instala (vía apt, como root en esta capa) las librerías de sistema que
# Chromium necesita para arrancar en un contenedor (libnss3, libatk, libgbm, etc.) — sin esto el
# build termina bien pero Chromium revienta en runtime con errores de librerías compartidas faltantes.
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 4100

CMD ["node", "src/index.js"]
