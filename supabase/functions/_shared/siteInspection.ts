// Evidencia real del sitio: en vez de un fetch() crudo (que no ejecuta JS, no ve SPAs, y solo
// podía dar título/descripción por regex) le pedimos a evidence-service — un microservicio Node
// con Playwright corriendo en el VPS del usuario — que abra la página de verdad y devuelva
// screenshot, DOM renderizado, violaciones de accesibilidad (axe-core) y, para la home, Lighthouse.
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

const INSPECT_TIMEOUT_MS = 45000;

export async function inspectSite(url: string, options: { lighthouse?: boolean } = {}): Promise<SiteInspection> {
  const serviceUrl = Deno.env.get("EVIDENCE_SERVICE_URL");
  if (!serviceUrl) {
    console.error("inspectSite: EVIDENCE_SERVICE_URL no está configurado");
    return EMPTY_INSPECTION;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), INSPECT_TIMEOUT_MS);

    const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/inspect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(Deno.env.get("EVIDENCE_SERVICE_KEY")
          ? { "x-evidence-key": Deno.env.get("EVIDENCE_SERVICE_KEY")! }
          : {}),
      },
      body: JSON.stringify({ url, lighthouse: options.lighthouse ?? false }),
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
