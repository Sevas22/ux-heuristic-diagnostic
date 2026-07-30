import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { STATUS_COLORS, severityStatus } from "@/lib/severity";
import type { Finding, Effort } from "@/hooks/useReportPolling";

const EFFORT_ORDER: Effort[] = ["Bajo", "Medio", "Alto"];

/** Impacto alto = severidad importante/crítica, o impact_score alto declarado por el análisis. */
function isHighImpact(f: Finding): boolean {
  return f.severity >= 3 || f.impact_score >= 0.6;
}

interface Phase {
  key: string;
  numeral: string;
  title: string;
  window: string;
  rationale: string;
  findings: Finding[];
}

// El roadmap sale de cruzar impacto con esfuerzo, no de una lista que escribe el modelo: así el
// orden es reproducible y cada fase se justifica sola frente al cliente.
export function buildPhases(findings: Finding[]): Phase[] {
  const effortOf = (f: Finding): Effort => f.effort ?? "Medio";

  const quickWins = findings.filter((f) => isHighImpact(f) && effortOf(f) === "Bajo");
  const major = findings.filter((f) => isHighImpact(f) && effortOf(f) !== "Bajo");
  const rest = findings.filter((f) => !isHighImpact(f));

  return [
    {
      key: "quick",
      numeral: "Fase 1",
      title: "Quick wins",
      window: "Sprint actual",
      rationale: "Alto impacto y bajo esfuerzo: se resuelven con cambios acotados y mueven la aguja de inmediato.",
      findings: quickWins,
    },
    {
      key: "mid",
      numeral: "Fase 2",
      title: "Mejoras estructurales",
      window: "Próximo trimestre",
      rationale: "Alto impacto pero requieren rediseño o desarrollo: hay que planificarlos, no improvisarlos.",
      findings: major,
    },
    {
      key: "long",
      numeral: "Fase 3",
      title: "Refinamiento",
      window: "Backlog priorizado",
      rationale: "Impacto menor: se abordan cuando no compitan con lo anterior, o se agrupan en una revisión de consistencia.",
      findings: rest,
    },
  ].filter((p) => p.findings.length > 0);
}

export default function ImpactEffortPlan({
  findings,
  sectionNumber,
}: {
  findings: Finding[];
  sectionNumber: number;
}) {
  if (findings.length === 0) return null;

  const phases = buildPhases(findings);
  const effortOf = (f: Finding): Effort => f.effort ?? "Medio";

  return (
    <>
      <Card className="mb-6 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {sectionNumber}
            </span>
            Impacto vs esfuerzo
          </CardTitle>
          <CardDescription>
            Cada hallazgo ubicado según cuánto mueve la aguja y cuánto cuesta implementarlo. La
            columna de la izquierda es por dónde empezar.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Impacto \ Esfuerzo</th>
                {EFFORT_ORDER.map((e) => (
                  <th key={e} className="py-2 pr-3 text-center font-medium">
                    {e}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[true, false].map((high) => (
                <tr key={String(high)} className="border-b border-border/50 align-top">
                  <td className="py-2.5 pr-3 font-medium">{high ? "Alto" : "Bajo / medio"}</td>
                  {EFFORT_ORDER.map((effort) => {
                    const cell = findings.filter((f) => isHighImpact(f) === high && effortOf(f) === effort);
                    return (
                      <td key={effort} className="py-2.5 pr-3 text-center">
                        {cell.length === 0 ? (
                          <span className="text-muted-foreground/50">—</span>
                        ) : (
                          <div className="flex flex-wrap justify-center gap-1">
                            {cell.map((f) => (
                              <a
                                key={f.id}
                                href={`#${f.id}`}
                                title={f.description}
                                className="rounded px-1.5 py-0.5 font-medium text-white"
                                style={{ backgroundColor: STATUS_COLORS[severityStatus(f.severity)] }}
                              >
                                {f.id}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Roadmap de implementación</CardTitle>
          <CardDescription>
            Las fases se derivan del cruce anterior, no de una lista redactada aparte: cada hallazgo
            cae en la fase que le corresponde por su impacto y su costo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {phases.map((p) => (
            <div key={p.key} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-foreground">
                  <span className="text-primary">{p.numeral}</span> · {p.title}
                </p>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {p.window} · {p.findings.length} hallazgo{p.findings.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.rationale}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.findings.map((f) => (
                  <a
                    key={f.id}
                    href={`#${f.id}`}
                    title={f.description}
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: STATUS_COLORS[severityStatus(f.severity)] }}
                  >
                    {f.id}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
