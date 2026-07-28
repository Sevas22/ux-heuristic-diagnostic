import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusDot from "@/components/report/StatusDot";
import { severityStatus, priorityStatus } from "@/lib/severity";
import { describeEvidenceRef } from "@/lib/evidenceRef";
import type { Finding } from "@/hooks/useReportPolling";

const SEVERITY_LABEL: Record<number, string> = {
  0: "Sin problema",
  1: "Cosmético",
  2: "Menor",
  3: "Importante",
  4: "Crítico",
};

export default function FindingCard({ finding }: { finding: Finding }) {
  return (
    <Card id={finding.id} className="scroll-mt-6 target:ring-2 target:ring-primary print:break-inside-avoid">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="mb-1 font-medium text-foreground">Descripción</p>
          <p className="text-muted-foreground">{finding.description}</p>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">Impacto en el usuario</p>
          <p className="text-muted-foreground">{finding.user_impact}</p>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">Recomendación</p>
          <p className="text-muted-foreground">{finding.recommendation}</p>
        </div>
        <StatusDot status={priorityStatus(finding.priority)} label={`Prioridad ${finding.priority}`} />
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
