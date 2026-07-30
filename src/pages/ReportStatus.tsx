import { useState } from "react";
import { useParams } from "react-router-dom";
import { useReportPolling, normalizeLighthouse } from "@/hooks/useReportPolling";
import { exportElementToPdf } from "@/lib/exportPdf";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FindingCard from "@/components/report/FindingCard";
import MermaidDiagram from "@/components/report/MermaidDiagram";
import ReportCover from "@/components/report/ReportCover";
import LighthouseScores from "@/components/report/LighthouseScores";
import AccessibilityAudit from "@/components/report/AccessibilityAudit";
import CapturedEvidencePanel from "@/components/report/CapturedEvidencePanel";
import AnnotatedScreenshot from "@/components/report/AnnotatedScreenshot";
import ReferenceComparison from "@/components/report/ReferenceComparison";
import PriorityMatrix from "@/components/report/PriorityMatrix";
import StatusDot from "@/components/report/StatusDot";
import { severityStatus, priorityStatus } from "@/lib/severity";
import { buildFlowchart, buildNavGraph, buildPie, buildJourney, buildPriorityFlowchart } from "@/lib/mermaidBuilders";
import { Loader2, Download, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const SEVERITY_LEGEND = [
  { level: 0, label: "Sin problema" },
  { level: 1, label: "Cosmético" },
  { level: 2, label: "Menor" },
  { level: 3, label: "Importante" },
  { level: 4, label: "Crítico" },
];

// Nombres cortos para el pie chart: las heurísticas son un set fijo y conocido, así que en vez de
// truncar el texto a la fuerza (perdiendo palabras a mitad de camino) usamos una versión abreviada
// pero completa y legible de cada una.
const HEURISTIC_SHORT_LABELS: Record<string, string> = {
  "Visibilidad del estado del sistema": "Visibilidad del estado",
  "Correspondencia entre el sistema y el mundo real": "Correspondencia con la realidad",
  "Control y libertad del usuario": "Control y libertad",
  "Consistencia y estándares": "Consistencia y estándares",
  "Prevención de errores": "Prevención de errores",
  "Reconocer antes que recordar": "Reconocer vs. recordar",
  "Flexibilidad y eficiencia de uso": "Flexibilidad y eficiencia",
  "Diseño estético y minimalista": "Diseño minimalista",
  "Ayudar a los usuarios a reconocer, diagnosticar y recuperarse de errores": "Recuperación de errores",
  "Ayuda y documentación": "Ayuda y documentación",
  "Accesibilidad (WCAG)": "Accesibilidad (WCAG)",
};

export default function ReportStatus() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const { data, error, loading } = useReportPolling(accessToken);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  async function handleExportPdf() {
    if (!data) return;
    setExporting(true);
    setExportProgress(null);
    try {
      const domain = data.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      await exportElementToPdf(
        "report-content",
        `diagnostico-ux-${domain}.pdf`,
        (current, total) => setExportProgress({ current, total }),
        `Diagnóstico UX/UI · ${domain}`,
      );
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }

  if (loading) {
    return <CenteredMessage icon={<Loader2 className="h-8 w-8 animate-spin text-primary" />} title="Cargando..." />;
  }

  if (error || !data) {
    return (
      <CenteredMessage
        icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
        title="No encontramos ese informe"
        description="Revisa el enlace que recibiste por email, o contáctanos si el problema persiste."
      />
    );
  }

  if (data.status === "draft") {
    return (
      <CenteredMessage
        title="Pago pendiente"
        description="Aún no hemos confirmado tu pago. Si ya pagaste, espera unos segundos y recarga la página."
      />
    );
  }

  if (data.status === "paid" || data.status === "generating") {
    return (
      <CenteredMessage
        icon={<Loader2 className="h-8 w-8 animate-spin text-primary" />}
        title="Generando tu diagnóstico UX/UI..."
        description="Nuestro agente de IA está analizando tu producto a fondo. Esto puede tardar 1-3 minutos. Te avisaremos por email cuando esté listo."
      />
    );
  }

  if (data.status === "failed") {
    return (
      <CenteredMessage
        icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
        title="Tuvimos un problema generando tu informe"
        description="Nuestro equipo ya fue notificado. Escríbenos con este enlace y lo resolvemos manualmente."
      />
    );
  }

  const findings = data.findings ?? [];
  const heuristicCounts = findings.reduce<Record<string, number>>((acc, f) => {
    const label = HEURISTIC_SHORT_LABELS[f.heuristic] ?? f.heuristic;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const userFlowChart = data.user_flow ? buildFlowchart(data.user_flow, data.goal) : null;
  const navGraphChart = data.navigation_graph ? buildNavGraph(data.navigation_graph) : null;
  const pieChart = buildPie(heuristicCounts);
  const journeyChart = data.journey_map ? buildJourney(data.journey_map) : null;
  const criticalCount = findings.filter((f) => f.severity === 4).length;
  const quickWinsCount = data.conclusions?.quick_wins.length ?? 0;
  const highPriorityCount = findings.filter((f) => f.priority === "Alta").length;
  const priorityFlowchart = findings.length > 0
    ? buildPriorityFlowchart({ critical: criticalCount, quickWins: quickWinsCount, highPriority: highPriorityCount })
    : null;

  const lighthouse = normalizeLighthouse(data.lighthouse);

  // Se recrea en cada render para que la numeración siempre empiece en 1.
  const nextSection = createSectionCounter();

  return (
    <div id="report-content" className="container mx-auto max-w-3xl py-12 print:py-0">
      {/* El título y el dominio los muestra la portada; acá solo va la acción, para no repetirlos. */}
      <div className="mb-4 flex justify-end print:hidden">
        <Button variant="outline" onClick={handleExportPdf} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting
            ? exportProgress
              ? `Generando PDF... (${exportProgress.current}/${exportProgress.total})`
              : "Generando PDF..."
            : "Descargar PDF"}
        </Button>
      </div>

      <div data-pdf-section>
        <ReportCover
          websiteUrl={data.website_url}
          overallScore={data.overall_score ?? 0}
          findingsCount={findings.length}
          criticalCount={criticalCount}
          quickWinsCount={quickWinsCount}
          createdAt={data.created_at}
          industry={data.industry}
        />
      </div>

      <PartHeading
        numeral="I"
        title="Resumen y contexto"
        description="Qué encontramos, con qué información partimos y cómo se evaluó."
      />

      {data.executive_summary && (
        <Card data-pdf-section className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SectionNumber n={nextSection()} />
              Resumen ejecutivo
            </CardTitle>
            <CardDescription>{data.executive_summary.product_description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p><span className="font-medium text-foreground">Objetivo del análisis: </span>{data.executive_summary.analysis_objective}</p>
            <p className="text-muted-foreground">{data.executive_summary.general_assessment}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" /> Fortalezas
                </p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {data.executive_summary.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 font-medium text-destructive">
                  <XCircle className="h-4 w-4" /> Debilidades
                </p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {data.executive_summary.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contexto compartido por el solicitante */}
      {(data.industry || data.goal || (data.reference_urls && data.reference_urls.length > 0)) && (
        <Card data-pdf-section className="mb-6 shadow-card">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionNumber n={nextSection()} />
              Contexto que compartiste
            </CardTitle>
            {data.industry && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Industria:</span> {data.industry}
              </p>
            )}
            {data.goal && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Objetivo:</span> {data.goal}
              </p>
            )}
            {data.reference_urls && data.reference_urls.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-sm font-medium text-foreground">Referencias:</span>
                {data.reference_urls.map((url) => (
                  <Badge key={url} variant="secondary">
                    {url.replace(/^https?:\/\//, "")}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
        </Card>
      )}

      {data.methodology && (
        <Card data-pdf-section className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionNumber n={nextSection()} />
              Metodología
            </CardTitle>
            <CardDescription>{data.methodology.criteria}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p><span className="font-medium text-foreground">Flujo analizado: </span>{data.methodology.flow_analyzed}</p>
            <div>
              <p className="mb-1 font-medium text-foreground">Pantallas evaluadas</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {data.methodology.screens_evaluated.map((url) => <li key={url}>{url}</li>)}
              </ul>
            </div>
            <div>
              <p className="mb-2 font-medium text-foreground">Escala de severidad</p>
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1 pr-4">Severidad</th>
                    <th className="py-1">Significado</th>
                  </tr>
                </thead>
                <tbody>
                  {SEVERITY_LEGEND.map((s) => (
                    <tr key={s.level} className="border-b border-border/50">
                      <td className="py-1 pr-4 font-medium">{s.level}</td>
                      <td className="py-1 text-muted-foreground">{s.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <PartHeading
        numeral="II"
        title="Evidencia capturada"
        description="Lo que se extrajo del sitio real con un navegador: captura, contenido y auditoría técnica. Es la base verificable de todo lo que sigue."
      />

      {data.screenshot_url && (
        <div data-pdf-section>
          <AnnotatedScreenshot
            screenshotUrl={data.screenshot_url}
            websiteUrl={data.website_url}
            findings={findings}
            alt={`Captura de ${data.website_url}`}
            sectionNumber={nextSection()}
          />
        </div>
      )}

      {data.captured_evidence && (
        <div data-pdf-section>
          <CapturedEvidencePanel evidence={data.captured_evidence} sectionNumber={nextSection()} />
        </div>
      )}

      {data.captured_evidence && data.captured_evidence.axe_violations.length > 0 && (
        <div data-pdf-section>
          <AccessibilityAudit
            violations={data.captured_evidence.axe_violations}
            sectionNumber={nextSection()}
          />
        </div>
      )}

      {lighthouse && (
        <div data-pdf-section>
          <LighthouseScores lighthouse={lighthouse} sectionNumber={nextSection()} />
        </div>
      )}

      {data.screenshot_url && data.reference_screenshots && data.reference_screenshots.length > 0 && (
        <div data-pdf-section>
          <ReferenceComparison
            ownScreenshotUrl={data.screenshot_url}
            ownWebsiteUrl={data.website_url}
            references={data.reference_screenshots}
            sectionNumber={nextSection()}
          />
        </div>
      )}

      <PartHeading
        numeral="III"
        title="Recorrido y arquitectura"
        description="Cómo está estructurado el sitio y qué camino recorre el usuario hacia el objetivo declarado."
      />

      {userFlowChart && (
        <Card data-pdf-section className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionNumber n={nextSection()} />
              User Flow
            </CardTitle>
            <CardDescription>Recorrido sugerido hacia el objetivo declarado.</CardDescription>
          </CardHeader>
          <CardContent>
            <MermaidDiagram chart={userFlowChart} title="User Flow" />
          </CardContent>
        </Card>
      )}

      {/* 4. Arquitectura de navegación */}
      {navGraphChart && (
        <Card data-pdf-section className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionNumber n={nextSection()} />
              Arquitectura de navegación
            </CardTitle>
            <CardDescription>Mapa de las páginas reales analizadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <MermaidDiagram chart={navGraphChart} title="Arquitectura de navegación" />
          </CardContent>
        </Card>
      )}

      {journeyChart && (
        <Card data-pdf-section className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionNumber n={nextSection()} />
              Journey del usuario
            </CardTitle>
            <CardDescription>Calidad percibida en cada etapa del recorrido, de 1 a 5.</CardDescription>
          </CardHeader>
          <CardContent>
            <MermaidDiagram chart={journeyChart} title="Journey del usuario" />
          </CardContent>
        </Card>
      )}

      <PartHeading
        numeral="IV"
        title="Hallazgos"
        description="Cada problema detectado, con su severidad, el impacto en el usuario y la evidencia que lo respalda."
      />

      {findings.length > 0 && (
        <Card data-pdf-section className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionNumber n={nextSection()} />
              Tabla de hallazgos
            </CardTitle>
            <CardDescription>Vista general de los {findings.length} hallazgos, ordenados por ID.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Pantalla</th>
                  <th className="py-2 pr-3">Heurística</th>
                  <th className="py-2 pr-3">Severidad</th>
                  <th className="py-2 pr-3">Prioridad</th>
                  <th className="py-2">Problema</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr key={f.id} className="border-b border-border/50 align-top">
                    <td className="py-2 pr-3 font-medium">{f.id}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{f.screen === "General" ? "General" : f.screen.replace(/^https?:\/\//, "")}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{f.heuristic}</td>
                    <td className="py-2 pr-3">
                      <StatusDot status={severityStatus(f.severity)} label={String(f.severity)} />
                    </td>
                    <td className="py-2 pr-3">
                      <StatusDot status={priorityStatus(f.priority)} label={f.priority} />
                    </td>
                    <td className="py-2 text-muted-foreground">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 6. Fichas individuales por hallazgo */}
      {findings.length > 0 && (
        <div data-pdf-section className="mb-3 mt-6">
          <div className="flex items-center gap-2">
            <SectionNumber n={nextSection()} />
            <h3 className="text-base font-semibold">Fichas individuales por hallazgo</h3>
          </div>
          <p className="mt-1 pl-7 text-sm text-muted-foreground">
            El detalle de cada hallazgo: qué se observó, cómo afecta al usuario, qué hacer y sobre qué
            evidencia se sostiene.
          </p>
        </div>
      )}
      <div className="mb-6 space-y-4">
        {findings.map((f) => (
          <div key={f.id} data-pdf-section>
            <FindingCard finding={f} />
          </div>
        ))}
      </div>

      <PartHeading
        numeral="V"
        title="Priorización"
        description="Por dónde empezar: qué atacar primero según su severidad, su impacto y el esfuerzo que requiere."
      />

      {findings.length > 0 && (
        <Card data-pdf-section className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionNumber n={nextSection()} />
              Matriz impacto vs severidad
            </CardTitle>
            <CardDescription>Priorización de los hallazgos.</CardDescription>
          </CardHeader>
          <CardContent>
            <PriorityMatrix findings={findings} />
          </CardContent>
        </Card>
      )}

      {/* 8. Distribución de problemas por heurística */}
      {pieChart && (
        <Card data-pdf-section className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionNumber n={nextSection()} />
              Distribución de problemas por heurística
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MermaidDiagram chart={pieChart} title="Distribución por heurística" />
          </CardContent>
        </Card>
      )}

      {priorityFlowchart && (
        <Card data-pdf-section className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SectionNumber n={nextSection()} />
              Árbol de decisión: cómo priorizar
            </CardTitle>
            <CardDescription>El criterio que seguiríamos nosotros para triage, aplicado a tus propios números.</CardDescription>
          </CardHeader>
          <CardContent>
            <MermaidDiagram chart={priorityFlowchart} title="Árbol de decisión de priorización" />
          </CardContent>
        </Card>
      )}

      <PartHeading
        numeral="VI"
        title="Conclusiones y plan de acción"
        description="El resumen ejecutable: qué hacer esta semana, qué dejar para el próximo trimestre y qué se arriesga si no se hace nada."
      />

      {data.conclusions && (
        <Card data-pdf-section className="mb-6 border-primary/30 bg-primary-soft/40 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <SectionNumber n={nextSection()} />
                Conclusiones
              </span>
              <span className="text-2xl font-extrabold text-primary">{data.conclusions.final_score}/100</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ConclusionList title="Quick wins" items={data.conclusions.quick_wins} />
            <ConclusionList title="Mejoras a mediano plazo" items={data.conclusions.mid_term} />
            <ConclusionList title="Recomendaciones estratégicas" items={data.conclusions.strategic_recommendations} />
            <ConclusionList title="Riesgos si no se corrige" items={data.conclusions.risks} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Numerador de secciones: se incrementa SOLO cuando la sección efectivamente se renderiza. Antes
// los números estaban hardcodeados (n={1}, n={2}...), así que cualquier informe al que le faltara
// una sección condicional (user flow, arquitectura, journey...) mostraba huecos: 1, 2, 4, 5...
function createSectionCounter() {
  let n = 0;
  return () => ++n;
}

function SectionNumber({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {n}
    </span>
  );
}

// Separador de bloque temático. El informe tiene ~17 secciones: sin agruparlas, la lectura era una
// lista plana donde el análisis, la evidencia y los diagramas quedaban mezclados sin jerarquía.
function PartHeading({ numeral, title, description }: { numeral: string; title: string; description: string }) {
  return (
    <div data-pdf-section className="mb-4 mt-10 border-t-2 border-primary/20 pt-5 first:mt-0">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Parte {numeral}</p>
      <h2 className="mt-1 text-xl font-extrabold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ConclusionList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 font-medium text-foreground">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

function CenteredMessage({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="container mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 text-center">
      {icon}
      <h1 className="text-xl font-bold">{title}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  );
}
