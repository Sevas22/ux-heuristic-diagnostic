import { STATUS_COLORS, severityStatus } from "@/lib/severity";
import type { Finding } from "@/hooks/useReportPolling";

const SIZE = 340;
const PADDING = 40;
const PLOT = SIZE - PADDING * 2;

interface PlottedPoint {
  finding: Finding;
  x: number;
  y: number;
}

// Agrupa hallazgos con severidad/impacto casi idénticos y los separa en un mini-círculo,
// para que ningún punto quede oculto detrás de otro (el problema real del quadrantChart de Mermaid).
function layoutPoints(findings: Finding[]): PlottedPoint[] {
  const raw = findings.map((f) => ({
    finding: f,
    x: Math.min(Math.max(f.impact_score, 0), 1) * 100,
    y: 100 - Math.min(Math.max(f.severity / 4, 0), 1) * 100,
  }));

  const buckets = new Map<string, typeof raw>();
  for (const p of raw) {
    const key = `${Math.round(p.x / 7)}_${Math.round(p.y / 7)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }

  const result: PlottedPoint[] = [];
  for (const group of buckets.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    const angleStep = (2 * Math.PI) / group.length;
    const radius = 5.5;
    group.forEach((p, i) => {
      result.push({
        finding: p.finding,
        x: Math.min(Math.max(p.x + Math.cos(i * angleStep) * radius, 2), 98),
        y: Math.min(Math.max(p.y + Math.sin(i * angleStep) * radius, 2), 98),
      });
    });
  }
  return result;
}

function toSvg(v: number) {
  return PADDING + (v / 100) * PLOT;
}

export default function PriorityMatrix({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null;

  const points = layoutPoints(findings);
  const half = PLOT / 2;

  return (
    <div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 420 }} className="mx-auto block">
        {/* Fondo de los 4 cuadrantes */}
        <rect x={toSvg(0)} y={toSvg(100)} width={half} height={half} fill="#f9f9f7" />
        <rect x={toSvg(50)} y={toSvg(100)} width={half} height={half} fill="#fbeaea" />
        <rect x={toSvg(0)} y={toSvg(50)} width={half} height={half} fill="#eef4fc" />
        <rect x={toSvg(50)} y={toSvg(50)} width={half} height={half} fill="#fff2e0" />

        {/* Etiquetas de cuadrante */}
        <text x={toSvg(25)} y={toSvg(97)} textAnchor="middle" className="fill-muted-foreground" fontSize="9">Monitorear</text>
        <text x={toSvg(75)} y={toSvg(97)} textAnchor="middle" className="fill-muted-foreground" fontSize="9">Impacto oculto</text>
        <text x={toSvg(25)} y={toSvg(53)} textAnchor="middle" className="fill-muted-foreground" fontSize="9">Vigilar</text>
        <text x={toSvg(75)} y={toSvg(53)} textAnchor="middle" fontWeight="700" fill="#0b0b0b" fontSize="9">Prioridad máxima</text>

        {/* Ejes */}
        <line x1={toSvg(0)} y1={toSvg(50)} x2={toSvg(100)} y2={toSvg(50)} stroke="#c3c2b7" strokeWidth="1" />
        <line x1={toSvg(50)} y1={toSvg(0)} x2={toSvg(50)} y2={toSvg(100)} stroke="#c3c2b7" strokeWidth="1" />
        <rect x={toSvg(0)} y={toSvg(100)} width={PLOT} height={PLOT} fill="none" stroke="#898781" strokeWidth="1" />

        <text x={toSvg(0)} y={SIZE - 10} fontSize="10" className="fill-muted-foreground">Bajo impacto</text>
        <text x={toSvg(100)} y={SIZE - 10} textAnchor="end" fontSize="10" className="fill-muted-foreground">Alto impacto</text>
        <text x={12} y={toSvg(100)} fontSize="10" className="fill-muted-foreground" transform={`rotate(-90 12 ${toSvg(100)})`}>Baja severidad</text>
        <text x={12} y={toSvg(0)} fontSize="10" className="fill-muted-foreground" transform={`rotate(-90 12 ${toSvg(0)})`}>Alta severidad</text>

        {/* Puntos: uno por hallazgo, color = severidad, clic = va a la ficha */}
        {points.map((p) => {
          const color = STATUS_COLORS[severityStatus(p.finding.severity)];
          const cx = toSvg(p.x);
          const cy = toSvg(p.y);
          return (
            <a key={p.finding.id} href={`#${p.finding.id}`}>
              <circle cx={cx} cy={cy} r={7} fill={color} stroke="#fff" strokeWidth="1.5" />
              <text x={cx} y={cy + 18} textAnchor="middle" fontSize="8" fontWeight="600" className="fill-foreground">
                {p.finding.id}
              </text>
              <title>{`${p.finding.id} — ${p.finding.description}`}</title>
            </a>
          );
        })}
      </svg>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Cada punto es un hallazgo (color = severidad). Pasa el mouse para ver el detalle, o haz clic para ir a su ficha.
      </p>
    </div>
  );
}
