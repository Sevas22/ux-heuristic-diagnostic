import { Smartphone, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { STATUS_COLORS, scoreStatus } from "@/lib/severity";
import type { LighthouseScores as Scores, LighthouseReport } from "@/hooks/useReportPolling";

const CATEGORIES: { key: keyof Pick<Scores, "performance" | "accessibility" | "seo" | "bestPractices">; label: string }[] = [
  { key: "performance", label: "Rendimiento" },
  { key: "accessibility", label: "Accesibilidad" },
  { key: "seo", label: "SEO" },
  { key: "bestPractices", label: "Buenas prácticas" },
];

function formatWebVitals(s: Scores): string[] {
  const parts: string[] = [];
  if (s.lcpMs != null) parts.push(`LCP ${(s.lcpMs / 1000).toFixed(1)} s`);
  if (s.clsScore != null) parts.push(`CLS ${s.clsScore.toFixed(3)}`);
  if (s.tbtMs != null) parts.push(`TBT ${Math.round(s.tbtMs)} ms`);
  return parts;
}

function ScoreCell({ score }: { score: number }) {
  const color = STATUS_COLORS[scoreStatus(score)];
  return (
    <span className="text-lg font-extrabold tabular-nums" style={{ color }}>
      {score}
    </span>
  );
}

export default function LighthouseScores({
  lighthouse,
  sectionNumber,
}: {
  lighthouse: LighthouseReport;
  sectionNumber: number;
}) {
  const { mobile, desktop } = lighthouse;
  if (!mobile && !desktop) return null;

  // Google indexa y rankea por la versión móvil, así que si hay una diferencia grande entre ambas
  // vale la pena señalarla explícitamente en vez de dejar que el lector la deduzca de la tabla.
  const perfGap =
    mobile && desktop ? desktop.performance - mobile.performance : null;

  return (
    <Card className="mb-6 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {sectionNumber}
          </span>
          Métricas técnicas (Lighthouse)
        </CardTitle>
        <CardDescription>
          Medición real ejecutada por Google PageSpeed Insights sobre la página de inicio, en móvil y
          en escritorio. Google usa la versión móvil como referencia para posicionar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Categoría</th>
                {mobile && (
                  <th className="py-2 pr-3 text-center font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5" /> Móvil
                    </span>
                  </th>
                )}
                {desktop && (
                  <th className="py-2 text-center font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Monitor className="h-3.5 w-3.5" /> Escritorio
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(({ key, label }) => (
                <tr key={key} className="border-b border-border/50">
                  <td className="py-2.5 pr-3 text-muted-foreground">{label}</td>
                  {mobile && (
                    <td className="py-2.5 pr-3 text-center">
                      <ScoreCell score={mobile[key]} />
                    </td>
                  )}
                  {desktop && (
                    <td className="py-2.5 text-center">
                      <ScoreCell score={desktop[key]} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {mobile && <VitalsRow icon={<Smartphone className="h-3.5 w-3.5" />} label="Móvil" scores={mobile} />}
          {desktop && <VitalsRow icon={<Monitor className="h-3.5 w-3.5" />} label="Escritorio" scores={desktop} />}
        </div>

        {perfGap !== null && perfGap >= 15 && (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
            El rendimiento en móvil está <strong>{perfGap} puntos por debajo</strong> del de escritorio.
            Como Google evalúa la versión móvil para posicionar, esta brecha afecta tanto la
            experiencia de los usuarios en celular como la visibilidad del sitio en buscadores.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function VitalsRow({ icon, label, scores }: { icon: React.ReactNode; label: string; scores: Scores }) {
  const vitals = formatWebVitals(scores);
  if (vitals.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
        {icon} {label} — Core Web Vitals
      </p>
      <p className="text-xs text-muted-foreground">{vitals.join(" · ")}</p>
    </div>
  );
}
