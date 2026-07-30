import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusDot from "@/components/report/StatusDot";
import { severityStatus, priorityStatus, STATUS_COLORS } from "@/lib/severity";
import { describeEvidenceRef } from "@/lib/evidenceRef";
import type { Finding } from "@/hooks/useReportPolling";

const SEVERITY_LABEL: Record<number, string> = {
  0: "Sin problema",
  1: "Cosmético",
  2: "Menor",
  3: "Importante",
  4: "Crítico",
};

// Escalas cualitativas: se colorean por gravedad para que la ficha se lea de un vistazo, pero sin
// inventar precisión — "Recurrente" y "Medio" son juicios, no mediciones.
const FREQUENCY_COLOR: Record<string, string> = {
  Aislado: STATUS_COLORS.good,
  Recurrente: STATUS_COLORS.warning,
  Sistémico: STATUS_COLORS.critical,
};
const EFFORT_COLOR: Record<string, string> = {
  Bajo: STATUS_COLORS.good,
  Medio: STATUS_COLORS.warning,
  Alto: STATUS_COLORS.serious,
};

export default function FindingCard({ finding }: { finding: Finding }) {
  return (
    <Card id={finding.id} className="scroll-mt-6 target:ring-2 target:ring-primary print:break-inside-avoid">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">
            {finding.id} — {finding.heuristic}
          </CardTitle>
          <StatusDot
            status={severityStatus(finding.severity)}
            label={`Severidad ${finding.severity}: ${SEVERITY_LABEL[finding.severity] ?? "N/D"}`}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Pantalla: {finding.screen === "General" ? "General" : finding.screen.replace(/^https?:\/\//, "")}
        </p>

        {/* Fila de clasificación: los tres ejes que un equipo de producto necesita para decidir
            si esto entra en el sprint o al backlog. */}
        <div className="flex flex-wrap gap-1.5">
          <Chip label="Prioridad" value={finding.priority} color={STATUS_COLORS[priorityStatus(finding.priority)]} />
          {finding.frequency && (
            <Chip label="Frecuencia" value={finding.frequency} color={FREQUENCY_COLOR[finding.frequency]} />
          )}
          {finding.effort && (
            <Chip label="Esfuerzo" value={finding.effort} color={EFFORT_COLOR[finding.effort]} />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <Block title="Qué observamos">{finding.description}</Block>
        {finding.root_cause && <Block title="Por qué ocurre">{finding.root_cause}</Block>}
        <Block title="Impacto en el usuario">{finding.user_impact}</Block>
        {finding.business_impact && <Block title="Impacto en el negocio">{finding.business_impact}</Block>}

        <div className="rounded-md border border-primary/25 bg-primary-soft/30 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Recomendación</p>
          <p className="text-muted-foreground">{finding.recommendation}</p>
        </div>

        {finding.evidence_ref && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
            Evidencia: {describeEvidenceRef(finding.evidence_ref)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ borderColor: `${color}66`, color }}
    >
      <span className="text-muted-foreground">{label}:</span> {value}
    </span>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-medium text-foreground">{title}</p>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
