import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { STATUS_COLORS } from "@/lib/severity";
import type { AxeViolation } from "@/hooks/useReportPolling";

// axe-core clasifica cada violación por impacto real; lo mapeamos a la paleta de estado del
// informe para que "crítico" signifique visualmente lo mismo acá que en el resto del documento.
const IMPACT_META: Record<string, { label: string; color: string; order: number }> = {
  critical: { label: "Crítico", color: STATUS_COLORS.critical, order: 0 },
  serious: { label: "Serio", color: STATUS_COLORS.serious, order: 1 },
  moderate: { label: "Moderado", color: STATUS_COLORS.warning, order: 2 },
  minor: { label: "Menor", color: STATUS_COLORS.good, order: 3 },
};

function metaFor(impact: string) {
  return IMPACT_META[impact] ?? { label: impact, color: STATUS_COLORS.warning, order: 4 };
}

export default function AccessibilityAudit({
  violations,
  sectionNumber,
}: {
  violations: AxeViolation[];
  sectionNumber: number;
}) {
  if (violations.length === 0) return null;

  const sorted = [...violations].sort((a, b) => metaFor(a.impact).order - metaFor(b.impact).order);
  const affectedElements = violations.reduce((sum, v) => sum + v.nodeCount, 0);

  // Conteo por nivel de impacto, para el resumen de arriba.
  const byImpact = sorted.reduce<Record<string, number>>((acc, v) => {
    acc[v.impact] = (acc[v.impact] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="mb-6 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {sectionNumber}
          </span>
          Auditoría de accesibilidad (axe-core)
        </CardTitle>
        <CardDescription>
          {violations.length} regla{violations.length === 1 ? "" : "s"} WCAG incumplida
          {violations.length === 1 ? "" : "s"}, afectando {affectedElements} elemento
          {affectedElements === 1 ? "" : "s"} del DOM. Resultado de ejecutar el motor de reglas sobre
          la página ya renderizada — no es una estimación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(byImpact)
            .sort(([a], [b]) => metaFor(a).order - metaFor(b).order)
            .map(([impact, count]) => {
              const meta = metaFor(impact);
              return (
                <span
                  key={impact}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                  style={{ borderColor: meta.color, color: meta.color }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  {count} {meta.label}
                  {count === 1 ? "" : "s"}
                </span>
              );
            })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-3">Impacto</th>
                <th className="py-2 pr-3">Regla</th>
                <th className="py-2 pr-3">Qué falla</th>
                <th className="py-2 text-right">Elementos</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => {
                const meta = metaFor(v.impact);
                return (
                  <tr key={v.id} className="border-b border-border/50 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: meta.color }}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">{v.id}</code>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{v.help}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{v.nodeCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
