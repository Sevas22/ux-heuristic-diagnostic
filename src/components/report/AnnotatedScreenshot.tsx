import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ZONE_POSITION } from "@/lib/screenshotZones";
import { STATUS_COLORS, severityStatus } from "@/lib/severity";
import type { Finding } from "@/hooks/useReportPolling";

interface AnnotatedScreenshotProps {
  screenshotUrl: string;
  websiteUrl: string;
  findings: Finding[];
  alt: string;
  sectionNumber: number;
}

function pinLabel(id: string): string {
  const match = id.match(/\d+/);
  return match ? String(Number(match[0])) : "•";
}

export default function AnnotatedScreenshot({
  screenshotUrl,
  websiteUrl,
  findings,
  alt,
  sectionNumber,
}: AnnotatedScreenshotProps) {
  const pins = findings.filter((f) => f.zone && f.screen === websiteUrl);

  return (
    <Card className="mb-6 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {sectionNumber}
          </span>
          Captura de la página de inicio
        </CardTitle>
        <CardDescription>
          {pins.length > 0
            ? `Captura real del sitio. Los ${pins.length} marcadores señalan dónde se detectó cada hallazgo ubicable; el color indica su severidad.`
            : "Captura real del sitio, tomada con un navegador durante el análisis."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative overflow-hidden rounded-lg border border-border">
          <img src={screenshotUrl} alt={alt} className="block w-full" />
          {pins.map((f) => {
            const pos = ZONE_POSITION[f.zone!];
            const color = STATUS_COLORS[severityStatus(f.severity)];

            return (
              <a
                key={f.id}
                href={`#${f.id}`}
                title={`${f.id} — ${f.description}`}
                // Sin print:hidden a propósito: antes los marcadores se ocultaban al exportar, así
                // que en el PDF quedaba una captura pelada, sin ninguna referencia a los hallazgos.
                className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg ring-2 ring-white transition-transform hover:scale-110"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, backgroundColor: color }}
              >
                {pinLabel(f.id)}
              </a>
            );
          })}
        </div>

        {/* Sin esta leyenda los marcadores son números sueltos sobre una imagen: no se puede saber
            a qué hallazgo corresponde cada uno sin ir a buscarlo, y en el PDF ni siquiera hay
            enlaces en los que hacer clic. */}
        {pins.length > 0 && (
          <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
            {pins.map((f) => {
              const color = STATUS_COLORS[severityStatus(f.severity)];
              return (
                <li key={f.id} className="flex items-start gap-2">
                  <span
                    className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {pinLabel(f.id)}
                  </span>
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{f.id}</span> — {f.heuristic}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
