import { ZONE_POSITION } from "@/lib/screenshotZones";
import { STATUS_COLORS, severityStatus } from "@/lib/severity";
import type { Finding } from "@/hooks/useReportPolling";

interface AnnotatedScreenshotProps {
  screenshotUrl: string;
  websiteUrl: string;
  findings: Finding[];
  alt: string;
}

export default function AnnotatedScreenshot({ screenshotUrl, websiteUrl, findings, alt }: AnnotatedScreenshotProps) {
  const pins = findings.filter((f) => f.zone && f.screen === websiteUrl);

  return (
    <div className="relative mb-6 overflow-hidden rounded-lg border border-border shadow-card">
      <img src={screenshotUrl} alt={alt} className="block w-full" />
      {pins.map((f) => {
        const pos = ZONE_POSITION[f.zone!];
        const color = STATUS_COLORS[severityStatus(f.severity)];
        const number = f.id.match(/\d+/)?.[0] ? Number(f.id.match(/\d+/)![0]) : "•";

        return (
          <a
            key={f.id}
            href={`#${f.id}`}
            title={`${f.id} — ${f.description}`}
            className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg ring-2 ring-white transition-transform hover:scale-110 print:hidden"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, backgroundColor: color }}
          >
            {number}
          </a>
        );
      })}
    </div>
  );
}
