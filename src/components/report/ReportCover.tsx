import { ShieldCheck } from "lucide-react";
import { STATUS_COLORS, scoreStatus } from "@/lib/severity";

interface ReportCoverProps {
  websiteUrl: string;
  overallScore: number;
  findingsCount: number;
  criticalCount: number;
  quickWinsCount: number;
  createdAt: string | null;
  industry: string | null;
}

function formatDate(iso: string | null): string {
  const date = iso ? new Date(iso) : new Date();
  return date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

// Portada del informe. Antes el PDF arrancaba directo con una captura suelta, sin decir en ninguna
// parte qué documento era ni de qué sitio — el encabezado de la página está marcado print:hidden
// porque contiene el botón de descarga, así que nunca llegaba al PDF.
export default function ReportCover({
  websiteUrl,
  overallScore,
  findingsCount,
  criticalCount,
  quickWinsCount,
  createdAt,
  industry,
}: ReportCoverProps) {
  const domain = websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const scoreColor = STATUS_COLORS[scoreStatus(overallScore)];

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="bg-primary px-8 py-10 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
          Diagnóstico UX/UI Heurístico
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">{domain}</h1>
        <p className="mt-3 text-sm opacity-80">
          {industry ? `${industry} · ` : ""}
          {formatDate(createdAt)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        <CoverStat label="Puntaje general" value={String(overallScore)} suffix="/100" color={scoreColor} />
        <CoverStat label="Hallazgos" value={String(findingsCount)} />
        <CoverStat
          label="Críticos"
          value={String(criticalCount)}
          color={criticalCount > 0 ? STATUS_COLORS.critical : undefined}
        />
        <CoverStat label="Quick wins" value={String(quickWinsCount)} color={STATUS_COLORS.good} />
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-secondary/40 px-8 py-3 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
        Evaluado contra las 10 heurísticas de Nielsen. Cada hallazgo cita evidencia verificable
        capturada del sitio real.
      </div>
    </div>
  );
}

function CoverStat({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string;
  suffix?: string;
  color?: string;
}) {
  return (
    <div className="bg-card px-4 py-5 text-center">
      <p className="text-2xl font-extrabold leading-none" style={color ? { color } : undefined}>
        {value}
        {suffix && <span className="text-sm font-medium text-muted-foreground">{suffix}</span>}
      </p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
