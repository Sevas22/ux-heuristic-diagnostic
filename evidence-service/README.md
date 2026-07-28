# evidence-service

Funciones serverless (Vercel) que abren un sitio con Playwright y extraen evidencia real: screenshot full-page, encabezados y CTAs del DOM ya renderizado, y violaciones de accesibilidad (axe-core). `generate-report` (Supabase Edge Function) las consulta en vez de intentar hacerlo con `fetch()` crudo, que no puede ejecutar JS ni abrir un navegador.

En plan gratuito de Vercel **no se corre Lighthouse** — el límite de tiempo de una función serverless en Hobby no da margen confiable para Playwright + axe-core + Lighthouse en la misma invocación. El campo `lighthouse` de la respuesta queda siempre en `null`; si más adelante suben a un plan con más tiempo por función, se puede reactivar sin tocar el resto del sistema (el schema y la UI ya lo soportan).

## Por qué playwright-core + @sparticuz/chromium

El paquete `playwright` normal incluye su propio Chromium (~300MB) pensado para correr en un servidor persistente. En una función serverless eso no entra en los límites de tamaño de despliegue. `playwright-core` es Playwright sin el navegador incluido, y `@sparticuz/chromium` provee un binario de Chromium empaquetado específicamente para entornos serverless (Vercel/AWS Lambda).

## Por qué los screenshots van a Supabase Storage

Una función serverless no tiene disco persistente que el navegador del usuario pueda leer después — cada invocación es efímera. Por eso el screenshot se sube al bucket público `evidence-screenshots` de Supabase Storage (creado por la migración `0007_evidence_screenshots_bucket.sql`) y se devuelve esa URL pública.

## Desplegar en Vercel

1. En Vercel: **New Project** → importar el repo `Sevas22/ux-heuristic-diagnostic`.
2. **Root Directory**: `evidence-service` (importante — si no, Vercel intenta construir el frontend del repo raíz).
3. **Framework Preset**: "Other" (no es Next.js, son funciones sueltas en `api/`).
4. **Environment Variables**:
   - `EVIDENCE_SERVICE_KEY` — un secreto largo que vos elijas.
   - `SUPABASE_URL` — la misma URL del proyecto de Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY` — la service role key de Supabase (la que ya usa `generate-report`).
5. Deploy.
6. Correr la migración `0007_evidence_screenshots_bucket.sql` contra Supabase (crea el bucket público) si todavía no corrió.
7. Probar desde afuera:
   ```bash
   curl -X POST https://tu-proyecto.vercel.app/api/inspect \
     -H "Content-Type: application/json" \
     -H "x-evidence-key: TU_CLAVE" \
     -d '{"url":"https://stripe.com"}'
   ```
   Debería devolver `screenshotUrl` (una URL de Supabase Storage), `headings`, `ctas`, `axeViolations`.
8. En Supabase: `supabase secrets set EVIDENCE_SERVICE_URL=https://tu-proyecto.vercel.app EVIDENCE_SERVICE_KEY=TU_CLAVE`.

## Problemas conocidos de este stack en Vercel

- **`executablePath ENOENT` / no encuentra el binario de Chromium**: Vercel traza automáticamente qué archivos de `node_modules` incluir en el deploy de la función, y a veces no detecta el binario de `@sparticuz/chromium` porque lo lee con una ruta relativa dinámica. Por eso `vercel.json` ya trae `includeFiles: "node_modules/@sparticuz/chromium/**"` — si el error persiste, es la primera cosa a revisar.
- **Tamaño de la función**: si Vercel rechaza el build por tamaño, cambiar a `@sparticuz/chromium-min` (versión que no empaqueta el binario, lo descarga de una URL remota en runtime) — requiere pasarle esa URL a `executablePath()`.
- **Timeout**: si `/api/inspect` corta a los 10s en vez de los 60 configurados en `vercel.json`, confirmar en el dashboard de Vercel que el plan efectivamente permite `maxDuration: 60` para funciones Node — si no, bajar el valor para que coincida con lo que el plan permite.
- **"Fluid Compute" roto con Playwright**: hay reportes de que la opción "Fluid Compute" de Vercel (reutiliza instancias entre invocaciones) puede romper el lanzamiento del navegador. Si `/api/inspect` funciona a veces y falla otras de forma errática, probar desactivar Fluid Compute para este proyecto en Settings → Functions.
- **Versión de Chromium vs. playwright-core**: quedaron fijadas a una combinación conocida (`@sparticuz/chromium` 131.x + `playwright-core` 1.49.1, sin rango `^`, a propósito) — si en algún momento actualizás una sin la otra, revisar la [página de compatibilidad de Sparticuz](https://github.com/Sparticuz/chromium) antes de asumir que "la versión más nueva" funciona.
