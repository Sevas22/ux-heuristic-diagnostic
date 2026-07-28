import { ListChecks, AlertTriangle, Sparkles } from "lucide-react";
import { STATUS_COLORS, scoreStatus } from "@/lib/severity";

interface MetricsRowProps {
  overallScore: number;
  findingsCount: number;
  criticalCount: number;
  quickWinsCount: number;
}

function ScoreRing({ score, color, size = 68 }: { score: number; color: string; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-secondary" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-extrabold" style={{ color }}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}

function IconTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof ListChecks;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-extrabold leading-none text-foreground">{value}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function MetricsRow({ overallScore, findingsCount, criticalCount, quickWinsCount }: MetricsRowProps) {
  const scoreColor = STATUS_COLORS[scoreStatus(overallScore)];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
        <ScoreRing score={overallScore} color={scoreColor} />
        <div>
          <p className="text-2xl font-extrabold leading-none text-foreground">{overallScore}<span className="text-sm font-medium text-muted-foreground">/100</span></p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Puntaje general</p>
        </div>
      </div>
      <IconTile icon={ListChecks} label="Hallazgos totales" value={findingsCount} color="#2a78d6" />
      <IconTile
        icon={AlertTriangle}
        label="Críticos"
        value={criticalCount}
        color={criticalCount > 0 ? STATUS_COLORS.critical : "#898781"}
      />
      <IconTile icon={Sparkles} label="Quick wins" value={quickWinsCount} color={STATUS_COLORS.good} />
    </div>
  );
}
