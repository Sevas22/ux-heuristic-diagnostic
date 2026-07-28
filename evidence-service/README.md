# evidence-service

Microservicio Node.js que abre un sitio con Playwright y extrae evidencia real: screenshot full-page, encabezados y CTAs del DOM ya renderizado, violaciones de accesibilidad (axe-core) y, opcionalmente, métricas de Lighthouse. `generate-report` (Supabase Edge Function) lo consulta en vez de intentar hacerlo con `fetch()` crudo, que no puede ejecutar JS ni abrir un navegador.

## Desarrollo local

```bash
cd evidence-service
npm install
cp .env.example .env
npm start
```

`npm install` ya descarga el binario de Chromium para Playwright (`postinstall`). Probar con:

```bash
curl -X POST http://localhost:4100/inspect \
  -H "Content-Type: application/json" \
  -H "x-evidence-key: changeme" \
  -d '{"url":"https://stripe.com","lighthouse":true}'
```

## Despliegue en el VPS (manual, sin Docker)

1. Copiar `evidence-service/` al VPS, `npm install` ahí (Playwright necesita el Chromium del propio servidor, no sirve copiar el de tu máquina).
2. Configurar `.env` con `EVIDENCE_SERVICE_KEY` (generar un secreto largo) y `PUBLIC_BASE_URL` apuntando al dominio público del servicio.
3. Correr con `pm2 start src/index.js --name evidence-service` (o un unit de systemd equivalente) para que sobreviva reinicios.
4. Poner nginx delante con HTTPS (Let's Encrypt / certbot), reverse-proxy al puerto de `PORT` (4100 por defecto). El servicio ya agrega CORS abierto solo en `/shots/*` (las imágenes); `/inspect` no necesita CORS porque solo lo llama Supabase server-to-server.
5. En Supabase: `supabase secrets set EVIDENCE_SERVICE_URL=https://tu-dominio EVIDENCE_SERVICE_KEY=el-mismo-secreto-del-.env`.

## Despliegue con Dockploy (Docker)

Hay un `Dockerfile` en esta carpeta pensado justo para esto — usa `node:20-bookworm-slim` e instala las
librerías de sistema de Chromium vía `playwright install --with-deps` dentro del build, que es el paso
que un buildpack genérico (Nixpacks) normalmente no hace bien.

1. En Dockploy, crear la app apuntando a este repo/carpeta con **build method = Dockerfile** (no Nixpacks) y el contexto en `evidence-service/`.
2. Variables de entorno en Dockploy: `EVIDENCE_SERVICE_KEY` (el secreto largo) y `PUBLIC_BASE_URL` = la URL pública HTTPS que Dockploy te asigna (o tu dominio si le pusiste uno). Sin esto último, `screenshotUrl` saldría con `localhost` y nadie fuera del contenedor podría verla.
3. Exponer/mapear el puerto `4100` (o setear `PORT` si Dockploy te obliga a otro).
4. Una vez arriba, probar desde afuera:
   ```bash
   curl -X POST https://tu-dominio-dockploy/inspect \
     -H "Content-Type: application/json" \
     -H "x-evidence-key: TU_CLAVE" \
     -d '{"url":"https://stripe.com","lighthouse":true}'
   ```
   Si Chromium falla al lanzar (error de librerías compartidas), es señal de que el build no corrió `playwright install --with-deps` — confirmar que Dockploy está usando el `Dockerfile`, no auto-detectando el build.
5. En Supabase: `supabase secrets set EVIDENCE_SERVICE_URL=https://tu-dominio-dockploy EVIDENCE_SERVICE_KEY=TU_CLAVE`.
