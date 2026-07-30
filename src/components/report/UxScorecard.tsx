import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { STATUS_COLORS, scoreStatus } from "@/lib/severity";
import type { Finding, LighthouseReport } from "@/hooks/useReportPolling";

interface CategoryScore {
  label: string;
  score: number;
  /** De dónde sale el número: sin esto un puntaje es solo una opinión con formato. */
  basis: string;
}

// Penalización por hallazgo según severidad. Un crítico pesa mucho más que tres cosméticos, por eso
// no se promedia: se descuenta desde 100 y se acota el mínimo para que el puntaje siga siendo legible.
const SEVERITY_PENALTY: Record<number, number> = { 0: 0, 1: 2, 2: 5, 3: 10, 4: 18 };

function usabilityScore(findings: Finding[]): number {
  const penalty = findings.reduce((sum, f) => sum + (SEVERITY_PENALTY[f.severity] ?? 5), 0);
  return Math.max(10, 100 - penalty);
}

export function buildCategoryScores(
  findings: Finding[],
  lighthouse: LighthouseReport | null,
): CategoryScore[] {
  const scores: CategoryScore[] = [];

  const heuristicFindings = findings.filter((f) => f.heuristic !== "Accesibilidad (WCAG)");
  scores.push({
    label: "Usabilidad heurística",
    score: usabilityScore(heuristicFindings),
    basis: `${heuristicFindings.length} hallazgos ponderados por severidad`,
  });

  // Se prefiere el dato de Lighthouse por ser una medición; si no está, se cae a los hallazgos de axe.
  const lhA11y = lighthouse?.mobile?.accessibility ?? lighthouse?.desktop?.accessibility;
  const a11yFindings = findings.filter((f) => f.heuristic === "Accesibilidad (WCAG)");
  if (lhA11y != null) {
    scores.push({ label: "Accesibilidad", score: lhA11y, basis: "Lighthouse + axe-core" });
  } else if (a11yFindings.length > 0) {
    scores.push({
      label: "Accesibilidad",
      score: usabilityScore(a11yFindings),
      basis: `${a11yFindings.length} violaciones WCAG detectadas`,
    });
  }

  const perf = lighthouse?.mobile?.performance ?? lighthouse?.desktop?.performance;
  if (perf != null) {
    scores.push({
      label: "Rendimiento",
      score: perf,
      basis: lighthouse?.mobile ? "Lighthouse móvil" : "Lighthouse escritorio",
    });
  }

  const seo = lighthouse?.mobile?.seo ?? lighthouse?.desktop?.seo;
  if (seo != null) scores.push({ label: "SEO técnico", score: seo, basis: "Lighthouse" });

  return scores;
}

export default function UxScorecard({
  categories,
  overallScore,
  sectionNumber,
}: {
  categories: CategoryScore[];
  overallScore: number;
  sectionNumber: number;
}) {
  if (categories.length === 0) return null;

  return (
    <Card className="mb-6 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {sectionNumber}
          </span>
          UX Score por categoría
        </CardTitle>
        <CardDescription>
          Desglose del puntaje general ({overallScore}/100). Cada categoría indica sobre qué se
          calcula: las de rendimiento, SEO y accesibilidad salen de mediciones; la de usabilidad,
          de los hallazgos ponderados por severidad.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories.map((c) => {
          const color = STATUS_COLORS[scoreStatus(c.score)];
          return (
            <div key={c.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{c.label}</span>
                <span className="text-sm font-extrabold tabular-nums" style={{ color }}>
                  {c.score}
                  <span className="text-xs font-medium text-muted-foreground">/100</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(Math.max(c.score, 0), 100)}%`, backgroundColor: color }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{c.basis}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
