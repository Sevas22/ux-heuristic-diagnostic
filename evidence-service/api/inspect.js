import { chromium } from "playwright-core";
import chromiumBinary from "@sparticuz/chromium";
import { AxeBuilder } from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import path from "node:path";

// OJO: NO desactivar graphicsMode acá. Los flags de arranque de Chromium (--use-gl=angle
// --use-angle=swiftshader) se agregan siempre sin importar graphicsMode (bug conocido de esta
// versión de @sparticuz/chromium, ver github.com/Sparticuz/chromium/issues/247) — pero la
// extracción de la librería swiftshader que esos flags necesitan SÍ depende de graphicsMode.
// Desactivarlo deja a Chromium pidiendo una librería (libGLESv2.so) que nunca se extrajo, y
// crashea al arrancar. Se deja graphicsMode en su default (true) a propósito.

// Config del runtime serverless de Vercel: sin esto, maxDuration/memory de vercel.json solo
// aplican si además está declarado acá (Vercel lee ambos, pero conviene que coincidan).
export const config = {
  maxDuration: 60,
};

const MAX_HEADINGS = 20;
const MAX_CTAS = 20;
const CTA_MAX_LEN = 60;
const NAV_TIMEOUT_MS = 20000;
const NETWORK_IDLE_GRACE_MS = 5000;
const DOM_EVIDENCE_TIMEOUT_MS = 8000;
const AXE_TIMEOUT_MS = 15000;
const SCREENSHOT_TIMEOUT_MS = 10000;
// Presupuesto total para navegación + evidencia + axe + screenshot combinados, medido desde que
// el navegador termina de lanzar. Deja margen dentro de los 60s de maxDuration (Hobby) para el
// arranque de Chromium, la subida a Supabase Storage y la construcción de la respuesta.
const GLOBAL_BUDGET_MS = 40000;
const SCREENSHOT_BUCKET = "evidence-screenshots";

const NON_PAGE_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|rar|mp4|mp3|css|js|ico|xml|json)$/i;

// axe-core y el screenshot full-page pueden tardar mucho más de lo esperado en sitios pesados
// (DOM grande, muchos iframes, páginas muy largas — ej. stripe.com) y agotar los 60s de la función
// entera sin dejar rastro útil. Cada uno corre con su propio límite: si se pasa, seguimos con lo
// que sí tenemos (evidencia parcial) en vez de que Vercel mate la función entera sin explicación.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} superó ${ms}ms`)), ms)),
  ]);
}

async function extractDomEvidence(page) {
  return page.evaluate(
    ({ maxHeadings, maxCtas, maxLen }) => {
      const clean = (t) => t.replace(/\s+/g, " ").trim();

      const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
        .map((el) => clean(el.textContent || ""))
        .filter((t) => t.length > 0 && t.length <= 120)
        .slice(0, maxHeadings);

      const ctaSelectors = "button, a.btn, a[class*='btn'], a[class*='cta'], [role='button']";
      const ctas = Array.from(document.querySelectorAll(ctaSelectors))
        .map((el) => clean(el.textContent || el.getAttribute("aria-label") || ""))
        .filter((t) => t.length > 0 && t.length <= maxLen)
        .slice(0, maxCtas);

      const metaDescription =
        document.querySelector('meta[name="description"]')?.getAttribute("content") || null;

      return {
        title: document.title || null,
        metaDescription,
        headings: [...new Set(headings)],
        ctas: [...new Set(ctas)],
      };
    },
    { maxHeadings: MAX_HEADINGS, maxCtas: MAX_CTAS, maxLen: CTA_MAX_LEN },
  );
}

function extractInternalLinks(hrefs, baseUrl, limit) {
  const base = new URL(baseUrl);
  const seen = new Set([base.href]);
  const links = [];

  for (const raw of hrefs) {
    if (links.length >= limit) break;
    if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) continue;

    let resolved;
    try {
      resolved = new URL(raw, base);
    } catch {
      continue;
    }

    if (resolved.origin !== base.origin) continue;
    if (NON_PAGE_EXTENSIONS.test(resolved.pathname)) continue;

    resolved.hash = "";
    if (seen.has(resolved.href)) continue;
    seen.add(resolved.href);
    links.push(resolved.href);
  }

  return links;
}

function mapAxeViolations(violations) {
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact || "minor",
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodeCount: v.nodes.length,
  }));
}

let supabaseClient;
function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseClient;
}

// En serverless no hay disco persistente que el navegador del usuario pueda leer después,
// así que el screenshot va a un bucket público de Supabase Storage en vez de a un archivo local.
async function uploadScreenshot(buffer) {
  const path = `${randomUUID()}.png`;
  const { error } = await getSupabase()
    .storage.from(SCREENSHOT_BUCKET)
    .upload(path, buffer, { contentType: "image/png", upsert: false });
  if (error) throw error;

  const { data } = getSupabase().storage.from(SCREENSHOT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const apiKey = process.env.EVIDENCE_SERVICE_KEY;
  if (apiKey && req.headers["x-evidence-key"] !== apiKey) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url es requerida" });
    return;
  }

  let browser;
  let hardTimeout;
  try {
    const executablePath = await chromiumBinary.executablePath();
    // El fix real del error "libnss3.so/libnspr4.so: cannot open shared object file": apuntar el
    // linker dinámico a las carpetas donde @sparticuz/chromium extrae el binario y sus .so
    // acompañantes. No confiamos solo en que el setup interno del paquete lo haga (a veces, en
    // contenedores "fríos" de Vercel, no alcanza a tomar efecto) — las agregamos nosotros también,
    // a propósito de forma redundante; apuntar a una carpeta que no existe no hace daño.
    process.env.LD_LIBRARY_PATH = [
      path.dirname(executablePath),
      "/tmp/al2023/lib",
      "/tmp/al2/lib",
      process.env.LD_LIBRARY_PATH,
    ]
      .filter(Boolean)
      .join(":");

    browser = await chromium.launch({
      args: chromiumBinary.args,
      executablePath,
      headless: true,
      // dumpio:true (usado antes para debug) generaba overhead serio en sitios con mucho ruido de
      // consola/red (ej. stripe.com) al no drenarse el pipe activamente — contribuía a los timeouts.
      // Ya no hace falta: los crashes que buscaba diagnosticar se resolvieron por otra vía.
    });

    // Red de seguridad final: los timeouts de arriba (withTimeout) hacen que NUESTRO código deje
    // de esperar, pero no matan la operación de Playwright que quedó colgada de fondo — en
    // páginas muy pesadas eso puede seguir consumiendo el resto del presupuesto igual, sobre todo
    // con --single-process (que este paquete fuerza) donde el pipe de CDP puede quedar atascado.
    // Forzar el cierre del navegador SÍ rechaza cualquier operación pendiente de Playwright.
    let hardTimedOut = false;
    hardTimeout = setTimeout(() => {
      hardTimedOut = true;
      console.error("inspect: excedió el presupuesto total, forzando cierre del navegador", url);
      browser.close().catch(() => {});
    }, GLOBAL_BUDGET_MS);

    // @axe-core/playwright necesita que la página venga de un BrowserContext explícito para
    // poder inyectar su script de análisis; browser.newPage() por sí solo no alcanza.
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    // domcontentloaded como estrategia principal: es rápido y predecible. "networkidle" como
    // estrategia principal colgaba la navegación entera en sitios con analytics/chat en background
    // que nunca dejan de hacer requests (ej. stripe.com), agotando el maxDuration de la función
    // (60s en plan Hobby) antes de siquiera llegar a axe-core o al screenshot.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    // Margen corto y acotado para que termine de pintar contenido diferido — best-effort,
    // nunca bloquea más de NETWORK_IDLE_GRACE_MS aunque el sitio nunca llegue a estar "idle".
    await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_GRACE_MS }).catch(() => {});

    // page.evaluate()/$$eval() NO tienen timeout propio en Playwright — si el JS de la página
    // (ej. stripe.com) satura el hilo principal del navegador, estas llamadas pueden colgarse
    // indefinidamente sin que ningún límite posterior (axe/screenshot) llegue siquiera a correr.
    const [domEvidence, hrefs] = await Promise.all([
      withTimeout(extractDomEvidence(page), DOM_EVIDENCE_TIMEOUT_MS, "extracción de DOM").catch((err) => {
        console.error("inspect: extracción de DOM no terminó a tiempo", url, err.message);
        return { title: null, metaDescription: null, headings: [], ctas: [] };
      }),
      withTimeout(
        page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") || "")),
        DOM_EVIDENCE_TIMEOUT_MS,
        "extracción de links",
      ).catch((err) => {
        console.error("inspect: extracción de links no terminó a tiempo", url, err.message);
        return [];
      }),
    ]);

    // axe-core puede tardar mucho en un DOM grande/complejo — si se pasa del límite, seguimos
    // sin violaciones de accesibilidad en vez de perder todo el informe por esto.
    const axeResults = await withTimeout(new AxeBuilder({ page }).analyze(), AXE_TIMEOUT_MS, "axe-core").catch(
      (err) => {
        console.error("inspect: axe-core no terminó a tiempo", url, err.message);
        return { violations: [] };
      },
    );

    // Igual con el screenshot full-page: si una página muy larga tarda demasiado en renderizarse
    // completa, nos conformamos con un screenshot del viewport visible en vez de nada.
    const screenshotBuffer = await withTimeout(
      page.screenshot({ fullPage: true }),
      SCREENSHOT_TIMEOUT_MS,
      "screenshot full-page",
    ).catch(async (err) => {
      console.error("inspect: screenshot full-page no terminó a tiempo, se usa solo el viewport", url, err.message);
      // Este intento de respaldo también necesita su propio límite: si el navegador quedó
      // realmente trabado (no solo lento), un segundo intento sin timeout se cuelga igual de
      // indefinido hasta que Vercel mata la función entera — exactamente lo que queremos evitar.
      return withTimeout(page.screenshot({ fullPage: false }), SCREENSHOT_TIMEOUT_MS, "screenshot viewport").catch(
        () => null,
      );
    });

    clearTimeout(hardTimeout);
    if (hardTimedOut) {
      // El navegador ya se cerró solo (por el timer). Cada paso de arriba ya cayó a su valor de
      // respaldo por su propio catch — seguimos con lo que haya, en vez de tirar todo por la borda.
      console.error("inspect: se completó con evidencia parcial tras el cierre forzado", url);
    } else {
      await browser.close();
    }
    browser = undefined;

    const screenshotUrl = screenshotBuffer ? await uploadScreenshot(screenshotBuffer) : null;

    res.status(200).json({
      screenshotUrl,
      title: domEvidence.title,
      metaDescription: domEvidence.metaDescription,
      headings: domEvidence.headings,
      ctas: domEvidence.ctas,
      internalLinks: extractInternalLinks(hrefs, url, 5),
      axeViolations: mapAxeViolations(axeResults.violations),
      // El plan gratuito de Vercel no da margen de tiempo para correr Lighthouse de forma
      // confiable dentro del límite de una función serverless — queda null a propósito.
      lighthouse: null,
    });
  } catch (err) {
    console.error("inspect: fallo inspeccionando", url, err);
    res.status(500).json({ error: "No se pudo inspeccionar el sitio", detail: String(err?.message || err) });
  } finally {
    if (hardTimeout) clearTimeout(hardTimeout);
    if (browser) await browser.close().catch(() => {});
  }
}
