import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { ReferenceScreenshot } from "@/hooks/useReportPolling";

interface ReferenceComparisonProps {
  ownScreenshotUrl: string;
  ownWebsiteUrl: string;
  references: ReferenceScreenshot[];
  /** Número de sección, asignado por el informe para que la numeración sea continua. */
  sectionNumber: number;
}

function Thumb({ screenshotUrl, url, label }: { screenshotUrl: string; url: string; label?: string }) {
  return (
    <div>
      <div className="overflow-hidden rounded-md border border-border shadow-card">
        <img src={screenshotUrl} alt={`Captura de ${url}`} className="block h-40 w-full object-cover object-top" />
      </div>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">
        {label && <span className="font-medium text-foreground">{label}: </span>}
        {url.replace(/^https?:\/\//, "")}
      </p>
    </div>
  );
}

export default function ReferenceComparison({
  ownScreenshotUrl,
  ownWebsiteUrl,
  references,
  sectionNumber,
}: ReferenceComparisonProps) {
  if (references.length === 0) return null;

  return (
    <Card className="mb-6 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {sectionNumber}
          </span>
          Comparación visual
        </CardTitle>
        <CardDescription>Tu sitio junto a las referencias que compartiste.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Thumb screenshotUrl={ownScreenshotUrl} url={ownWebsiteUrl} label="Tu sitio" />
          {references.map((r) => (
            <Thumb key={r.url} screenshotUrl={r.screenshot_url} url={r.url} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
