import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { CapturedEvidence } from "@/hooks/useReportPolling";

// Muestra el texto real extraído del sitio. Es lo que vuelve auditable al informe: el cliente
// puede contrastar cada hallazgo contra los encabezados y CTAs que efectivamente tiene su página,
// en vez de tener que confiar en la palabra del modelo.
export default function CapturedEvidencePanel({
  evidence,
  sectionNumber,
}: {
  evidence: CapturedEvidence;
  sectionNumber: number;
}) {
  const { headings, ctas, page_title, meta_description } = evidence;
  if (headings.length === 0 && ctas.length === 0 && !page_title) return null;

  return (
    <Card className="mb-6 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {sectionNumber}
          </span>
          Evidencia capturada del sitio
        </CardTitle>
        <CardDescription>
          Texto extraído del DOM ya renderizado. Los hallazgos de este informe se apoyan en esta
          evidencia, así que podés contrastar cada afirmación contra lo que realmente publica tu sitio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {page_title && (
          <EvidenceRow label="Título de la página">
            <span className="text-muted-foreground">{page_title}</span>
          </EvidenceRow>
        )}

        {meta_description && (
          <EvidenceRow label="Meta descripción">
            <span className="text-muted-foreground">{meta_description}</span>
          </EvidenceRow>
        )}

        {headings.length > 0 && (
          <EvidenceRow label={`Encabezados detectados (${headings.length})`}>
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
              {headings.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </EvidenceRow>
        )}

        {ctas.length > 0 && (
          <EvidenceRow label={`Botones y llamadas a la acción (${ctas.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {ctas.map((c, i) => (
                <span key={i} className="rounded border border-border bg-secondary/60 px-2 py-0.5 text-xs">
                  {c}
                </span>
              ))}
            </div>
          </EvidenceRow>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      {children}
    </div>
  );
}
