import { Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { STATUS_COLORS, scoreStatus } from "@/lib/severity";
import type { LighthouseScores as LighthouseScoresType } from "@/hooks/useReportPolling";

const CATEGORY_LABELS: { key: keyof Pick<LighthouseScoresType, "performance" | "accessibility" | "seo" | "bestPractices">; label: string }[] = [
  { key: "performance", label: "Rendimiento" },
  { key: "accessibility", label: "Accesibilidad" },
  { key: "seo", label: "SEO" },
  { key: "bestPractices", label: "Buenas prácticas" },
];

function ScoreTile({ label, score }: { label: string; score: number }) {
  const color = STATUS_COLORS[scoreStatus(score)];
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-3 text-center shadow-card">
      <span className="text-2xl font-extrabold" style={{ color }}>{score}</span>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export default function LighthouseScores({ lighthouse }: { lighthouse: LighthouseScoresType }) {
  return (
    <Card className="mb-6 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-primary" /> Métricas técnicas (Lighthouse)
        </CardTitle>
        <CardDescription>Auditoría real ejecutada sobre la página de inicio, no estimada.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORY_LABELS.map(({ key, label }) => (
            <ScoreTile key={key} label={label} score={lighthouse[key]} />
          ))}
        </div>
        {(lighthouse.lcpMs != null || lighthouse.clsScore != null || lighthouse.tbtMs != null) && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {lighthouse.lcpMs != null && <span>LCP: {Math.round(lighthouse.lcpMs)} ms</span>}
            {lighthouse.clsScore != null && <span>CLS: {lighthouse.clsScore.toFixed(3)}</span>}
            {lighthouse.tbtMs != null && <span>TBT: {Math.round(lighthouse.tbtMs)} ms</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
