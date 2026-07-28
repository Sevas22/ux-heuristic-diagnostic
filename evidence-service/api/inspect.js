import { chromium } from "playwright-core";
import chromiumBinary from "@sparticuz/chromium";
import { AxeBuilder } from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Config del runtime serverless de Vercel: sin esto, maxDuration/memory de vercel.json solo
// aplican si además está declarado acá (Vercel lee ambos, pero conviene que coincidan).
export const config = {
  maxDuration: 60,
};

const MAX_HEADINGS = 20;
const MAX_CTAS = 20;
const CTA_MAX_LEN = 60;
const NAV_TIMEOUT_MS = 20000;
const SCREENSHOT_BUCKET = "evidence-screenshots";

const NON_PAGE_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|rar|mp4|mp3|css|js|ico|xml|json)$/i;

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
  try {
    browser = await chromium.launch({
      args: chromiumBinary.args,
      executablePath: await chromiumBinary.executablePath(),
      headless: true,
    });
    // @axe-core/playwright necesita que la página venga de un BrowserContext explícito para
    // poder inyectar su script de análisis; browser.newPage() por sí solo no alcanza.
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    await page
      .goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS })
      .catch(() => page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }));

    // Estas tres sí pueden ir en paralelo (evaluate/eval de solo lectura); el screenshot va
    // aparte y después, para no competir por el mismo page mientras axe inyecta su script.
    const [domEvidence, hrefs, axeResults] = await Promise.all([
      extractDomEvidence(page),
      page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") || "")),
      new AxeBuilder({ page }).analyze(),
    ]);
    const screenshotBuffer = await page.screenshot({ fullPage: true });

    await browser.close();
    browser = undefined;

    const screenshotUrl = await uploadScreenshot(screenshotBuffer);

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
    if (browser) await browser.close().catch(() => {});
  }
}
