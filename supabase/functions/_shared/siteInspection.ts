// Evidencia real del sitio: en vez de un fetch() crudo (que no ejecuta JS, no ve SPAs, y solo
// podía dar título/descripción por regex) le pedimos a evidence-service — funciones serverless en
// Vercel con Playwright — que abra la página de verdad y devuelva screenshot, DOM renderizado y
// violaciones de accesibilidad (axe-core). Lighthouse queda siempre en null: el plan gratuito de
// Vercel no da margen de tiempo confiable para correrlo dentro del límite de una función.
export interface AxeViolation {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | string;
  description: string;
  help: string;
  helpUrl: string;
  nodeCount: number;
}

export interface LighthouseResult {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
  lcpMs: number | null;
  clsScore: number | null;
  tbtMs: number | null;
}

export interface SiteInspection {
  screenshotUrl: string | null;
  title: string | null;
  metaDescription: string | null;
  headings: string[];
  ctas: string[];
  internalLinks: string[];
  axeViolations: AxeViolation[];
  lighthouse: LighthouseResult | null;
}

const EMPTY_INSPECTION: SiteInspection = {
  screenshotUrl: null,
  title: null,
  metaDescription: null,
  headings: [],
  ctas: [],
  internalLinks: [],
  axeViolations: [],
  lighthouse: null,
};

// Un poco más que el maxDuration de 60s configurado en evidence-service/vercel.json, para que sea
// Vercel quien corte la función (y devuelva un error legible) antes que nuestro propio abort.
const INSPECT_TIMEOUT_MS = 65000;

export async function inspectSite(url: string): Promise<SiteInspection> {
  const serviceUrl = Deno.env.get("EVIDENCE_SERVICE_URL");
  if (!serviceUrl) {
    console.error("inspectSite: EVIDENCE_SERVICE_URL no está configurado");
    return EMPTY_INSPECTION;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), INSPECT_TIMEOUT_MS);

    const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/api/inspect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(Deno.env.get("EVIDENCE_SERVICE_KEY")
          ? { "x-evidence-key": Deno.env.get("EVIDENCE_SERVICE_KEY")! }
          : {}),
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`inspectSite: evidence-service respondió ${res.status} para ${url}`, await res.text());
      return EMPTY_INSPECTION;
    }

    const data = await res.json();
    return {
      screenshotUrl: typeof data.screenshotUrl === "string" ? data.screenshotUrl : null,
      title: typeof data.title === "string" ? data.title : null,
      metaDescription: typeof data.metaDescription === "string" ? data.metaDescription : null,
      headings: Array.isArray(data.headings) ? data.headings.filter((h: unknown) => typeof h === "string") : [],
      ctas: Array.isArray(data.ctas) ? data.ctas.filter((c: unknown) => typeof c === "string") : [],
      internalLinks: Array.isArray(data.internalLinks)
        ? data.internalLinks.filter((l: unknown) => typeof l === "string")
        : [],
      axeViolations: Array.isArray(data.axeViolations) ? data.axeViolations : [],
      lighthouse: data.lighthouse ?? null,
    };
  } catch (err) {
    console.error("inspectSite: no se pudo inspeccionar", url, err);
    return EMPTY_INSPECTION;
  }
}

// Lighthouse vía la API de PageSpeed Insights de Google: corre en la infraestructura de Google,
// así que no compite por el presupuesto de tiempo de nuestras funciones (correrlo nosotros dentro
// de una función serverless no entraba en el límite del plan gratuito de Vercel).
const PAGESPEED_TIMEOUT_MS = 60000;

export async function fetchLighthouse(url: string): Promise<LighthouseResult | null> {
  const apiKey = Deno.env.get("PAGESPEED_API_KEY");
  if (!apiKey) {
    console.warn("fetchLighthouse: PAGESPEED_API_KEY no está configurado, se omiten las métricas");
    return null;
  }

  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", "desktop");
  endpoint.searchParams.set("key", apiKey);
  for (const category of ["performance", "accessibility", "seo", "best-practices"]) {
    endpoint.searchParams.append("category", category);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAGESPEED_TIMEOUT_MS);
    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`fetchLighthouse: PageSpeed respondió ${res.status}`, await res.text());
      return null;
    }

    const data = await res.json();
    const categories = data?.lighthouseResult?.categories;
    const audits = data?.lighthouseResult?.audits;
    if (!categories) return null;

    const toScore = (value: unknown) =>
      typeof value === "number" ? Math.round(value * 100) : 0;

    return {
      performance: toScore(categories.performance?.score),
      accessibility: toScore(categories.accessibility?.score),
      seo: toScore(categories.seo?.score),
      bestPractices: toScore(categories["best-practices"]?.score),
      lcpMs: audits?.["largest-contentful-paint"]?.numericValue ?? null,
      clsScore: audits?.["cumulative-layout-shift"]?.numericValue ?? null,
      tbtMs: audits?.["total-blocking-time"]?.numericValue ?? null,
    };
  } catch (err) {
    console.error("fetchLighthouse: no se pudo obtener métricas de PageSpeed", url, err);
    return null;
  }
}

export interface AccessibilityFinding {
  ruleId: string;
  criterion: string;
  severity: number;
  description: string;
  recommendation: string;
}

const IMPACT_SEVERITY: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};

// axe-core es un motor de reglas WCAG real corriendo sobre el DOM ya renderizado — a diferencia
// de los checks anteriores (regex sobre HTML crudo), esto detecta problemas reales de contraste,
// roles ARIA, foco, formularios, etc., no solo la presencia/ausencia de un puñado de atributos.
export function violationsToAccessibilityFindings(violations: AxeViolation[]): AccessibilityFinding[] {
  return violations
    .slice()
    .sort((a, b) => (IMPACT_SEVERITY[b.impact] ?? 0) - (IMPACT_SEVERITY[a.impact] ?? 0))
    .slice(0, 6)
    .map((v) => ({
      ruleId: v.id,
      criterion: v.help,
      severity: IMPACT_SEVERITY[v.impact] ?? 2,
      description: `${v.description} (${v.nodeCount} elemento${v.nodeCount === 1 ? "" : "s"} afectado${v.nodeCount === 1 ? "" : "s"}).`,
      recommendation: `Ver la guía de la regla axe "${v.id}": ${v.helpUrl}`,
    }));
}
