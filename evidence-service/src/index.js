import express from "express";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, "..", "shots");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const PORT = process.env.PORT || 4100;
const API_KEY = process.env.EVIDENCE_SERVICE_KEY;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const NAV_TIMEOUT_MS = 20000;
const MAX_HEADINGS = 20;
const MAX_CTAS = 20;
const CTA_MAX_LEN = 60;
const SHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const app = express();
app.use(express.json());

// El navegador del usuario carga las capturas directamente (vista del informe y export a PDF),
// por eso necesitan CORS abierto — a diferencia de /inspect, que solo llama el backend.
app.use(
  "/shots",
  express.static(SHOTS_DIR, {
    setHeaders: (res) => res.setHeader("Access-Control-Allow-Origin", "*"),
  }),
);

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  if (req.header("x-evidence-key") !== API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
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

const NON_PAGE_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|rar|mp4|mp3|css|js|ico|xml|json)$/i;

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

async function runLighthouseAudit(url) {
  let chrome;
  try {
    chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      onlyCategories: ["performance", "accessibility", "seo", "best-practices"],
      logLevel: "error",
    });
    const lhr = result.lhr;
    return {
      performance: Math.round((lhr.categories.performance?.score ?? 0) * 100),
      accessibility: Math.round((lhr.categories.accessibility?.score ?? 0) * 100),
      seo: Math.round((lhr.categories.seo?.score ?? 0) * 100),
      bestPractices: Math.round((lhr.categories["best-practices"]?.score ?? 0) * 100),
      lcpMs: lhr.audits["largest-contentful-paint"]?.numericValue ?? null,
      clsScore: lhr.audits["cumulative-layout-shift"]?.numericValue ?? null,
      tbtMs: lhr.audits["total-blocking-time"]?.numericValue ?? null,
    };
  } catch (err) {
    console.error("runLighthouseAudit: fallo el audit", err);
    return null;
  } finally {
    // Si chrome.kill() lanza (p.ej. EPERM limpiando el perfil temporal en Windows), no debe
    // tapar el resultado ya calculado arriba — un finally que lanza reemplaza el return del try.
    if (chrome) {
      try {
        await chrome.kill();
      } catch (killErr) {
        console.error("runLighthouseAudit: no se pudo cerrar chrome (no crítico)", killErr);
      }
    }
  }
}

app.post("/inspect", requireApiKey, async (req, res) => {
  const { url, lighthouse: wantLighthouse } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url es requerida" });
  }

  let browser;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox"] });
    // @axe-core/playwright necesita que la página venga de un BrowserContext explícito para
    // poder inyectar su script de análisis; browser.newPage() por sí solo no alcanza.
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    // networkidle da mejor evidencia (SPAs terminan de renderizar), pero algunos sitios nunca
    // llegan a estar "idle" (polling, websockets); si eso falla, nos conformamos con domcontentloaded.
    await page
      .goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS })
      .catch(() => page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }));

    const [domEvidence, hrefs, axeResults] = await Promise.all([
      extractDomEvidence(page),
      page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") || "")),
      new AxeBuilder({ page }).analyze(),
    ]);

    const shotId = randomUUID();
    const shotPath = path.join(SHOTS_DIR, `${shotId}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });

    await browser.close();
    browser = undefined;

    const lighthouseResult = wantLighthouse ? await runLighthouseAudit(url) : null;

    res.json({
      screenshotUrl: `${PUBLIC_BASE_URL}/shots/${shotId}.png`,
      title: domEvidence.title,
      metaDescription: domEvidence.metaDescription,
      headings: domEvidence.headings,
      ctas: domEvidence.ctas,
      internalLinks: extractInternalLinks(hrefs, url, 5),
      axeViolations: mapAxeViolations(axeResults.violations),
      lighthouse: lighthouseResult,
    });
  } catch (err) {
    console.error("inspect: fallo inspeccionando", url, err);
    res.status(500).json({ error: "No se pudo inspeccionar el sitio", detail: String(err?.message || err) });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// Los screenshots full-page se acumulan con cada informe generado; sin esto el disco del VPS
// crece sin límite. Se conservan 24h (suficiente para depurar un informe reciente) y se limpian solas.
function cleanupOldShots() {
  const now = Date.now();
  for (const file of fs.readdirSync(SHOTS_DIR)) {
    const filePath = path.join(SHOTS_DIR, file);
    try {
      if (now - fs.statSync(filePath).mtimeMs > SHOT_MAX_AGE_MS) fs.unlinkSync(filePath);
    } catch {
      // el archivo pudo haberse borrado entre el readdir y el stat; no es un error real
    }
  }
}
setInterval(cleanupOldShots, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`evidence-service escuchando en :${PORT}`);
});
