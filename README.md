# Diagnóstico UX/UI Heurístico

Agente de IA que evalúa un producto digital contra las 10 heurísticas de usabilidad de Nielsen y entrega un informe accionable. El usuario comparte contexto (dominio, industria, sitios de referencia que le gustan y qué quiere lograr) y el agente visita el sitio, captura una imagen y metadatos automáticamente, y genera un diagnóstico orientado a ese objetivo.

**Modo actual: sin pasarela de pago.** El flujo es formulario de contexto → generación inmediata del informe con Groq → se muestra en pantalla (y por email si configuras Resend). Stripe Checkout ya está construido (`create-checkout-session`, `stripe-webhook`) pero desconectado — ver [Reactivar el pago](#reactivar-el-pago-más-adelante) al final.

## Stack

- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui
- Backend: Supabase (Postgres, Edge Functions)
- IA: Groq (modelo de visión sobre la captura auto-generada, con fallback a texto si la captura falla)
- Captura de pantalla del sitio: [thum.io](https://thum.io) (gratis, sin API key — ver nota abajo)
- Metadatos del sitio (`<title>`, meta description): fetch directo hecho por la Edge Function
- Email (opcional): Resend

## Poner esto en marcha

Solo se necesitan dos cuentas gratis:

1. **Supabase**: crea un proyecto en [supabase.com](https://supabase.com). En Project Settings → API copia: `Project URL`, `anon public key` y `service_role key`.
2. **Groq**: crea una API key gratis en [console.groq.com](https://console.groq.com).

## Setup local

```sh
npm install
cp .env.example .env   # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

### Base de datos

Con el [CLI de Supabase](https://supabase.com/docs/guides/cli) instalado y logueado (`npx supabase login`):

```sh
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push        # aplica supabase/migrations/0001_init.sql
```

### Edge Functions

```sh
npx supabase secrets set SKIP_PAYMENT=true GROQ_API_KEY=gsk_... SITE_URL=http://localhost:8081

npx supabase functions deploy generate-report
```

No hace falta desplegar `create-checkout-session` ni `stripe-webhook` mientras el pago esté desactivado.

### Email (opcional)

Si quieres que el usuario también reciba el enlace al informe por correo, crea una cuenta en [resend.com](https://resend.com), y agrega `RESEND_API_KEY` y `RESEND_FROM_EMAIL` a los secretos. Sin esto, el informe simplemente se muestra en la página tras generarse (el usuario no necesita salir de la app).

## Estructura

```
src/
  pages/         Landing, formulario (dominio + contacto), página de informe
  components/ui/ primitivas shadcn
  components/report/  tarjetas de heurísticas
  hooks/         polling del estado del informe
  lib/           cliente de Supabase
supabase/
  migrations/    esquema SQL (tablas, RLS, funciones RPC)
  functions/     Edge Functions (checkout, webhook, inspección del sitio + generación con Groq)
```

## Notas de seguridad

- Las tablas `submissions`/`reports` no tienen policies de lectura/escritura para `anon`/`authenticated`: todo el acceso público pasa por las funciones RPC `create_submission` y `get_report_by_token` (`security definer`), que exponen solo lo necesario.
- `generate-report` marca la submission como `generating` de forma atómica antes de procesar — así una llamada repetida (doble clic, reintento) no genera el informe dos veces.
- Ninguna clave secreta (Groq, Resend, service role) se expone al frontend; solo viven como secretos de Edge Functions.

## Captura de pantalla automática

`generate-report` usa [thum.io](https://thum.io) para capturar la página de inicio del dominio ingresado, sin necesidad de API key — suficiente para un MVP, pero con límites de uso y disponibilidad no garantizados. Si la captura falla (sitio con bot-detection, timeout, etc.), el diagnóstico se genera igual usando solo el título/descripción de la página, sin bloquear al usuario. Para producción con más volumen, conviene migrar `buildScreenshotUrl` en `supabase/functions/_shared/siteInspection.ts` a un servicio pago (screenshotone.com, urlbox.io) con mejor SLA.

## Reactivar el pago más adelante

1. Quita el secreto `SKIP_PAYMENT` (o ponlo en `false`) — `generate-report` volverá a exigir estado `paid`.
2. Configura `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y despliega `create-checkout-session` y `stripe-webhook --no-verify-jwt`.
3. En `src/pages/IntakeForm.tsx`, reemplaza la llamada directa a `generate-report` por la llamada a `create-checkout-session` y el redirect a `checkout.url` (es el mismo patrón que ya usa `stripe-webhook` para disparar `generate-report` tras el pago).

No hace falta tocar el esquema de base de datos ni el resto de las Edge Functions.
