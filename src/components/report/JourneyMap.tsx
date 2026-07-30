import { STATUS_COLORS } from "@/lib/severity";
import type { JourneySection } from "@/hooks/useReportPolling";

// Reemplaza al diagrama "journey" de Mermaid, que dibujaba caritas emoji, dejaba un hueco vertical
// enorme y metía el puntaje como texto dentro de la etiqueta. Acá el puntaje ES la posición del
// punto: se ve de un vistazo en qué etapa cae la experiencia, que es lo que el gráfico debe contar.
const WIDTH = 760;
const AXIS_W = 26;
const PHASE_Y = 4;
const PHASE_H = 22;
const PLOT_TOP = 46;
const PLOT_H = 150;
const LABEL_TOP = PLOT_TOP + PLOT_H + 22;
const LABEL_LINE_H = 12;
const MAX_LABEL_LINES = 3;
const HEIGHT = LABEL_TOP + LABEL_LINE_H * MAX_LABEL_LINES + 14;

function scoreColor(score: number): string {
  if (score >= 4) return STATUS_COLORS.good;
  if (score >= 3) return STATUS_COLORS.warning;
  if (score >= 2) return STATUS_COLORS.serious;
  return STATUS_COLORS.critical;
}

// SVG no reparte texto en varias líneas por sí solo: hay que cortarlo a mano.
function wrapLabel(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (last.length > maxChars) lines[maxLines - 1] = `${last.slice(0, maxChars - 1)}…`;
  }
  return lines;
}

interface FlatStep {
  label: string;
  score: number;
  sectionIndex: number;
}

export default function JourneyMap({ sections }: { sections: JourneySection[] }) {
  const valid = sections.filter((s) => s.steps.length > 0);
  const steps: FlatStep[] = valid.flatMap((s, sectionIndex) =>
    s.steps.map((step) => ({
      label: step.label,
      score: Math.min(Math.max(Math.round(step.score), 1), 5),
      sectionIndex,
    })),
  );
  if (steps.length === 0) return null;

  const plotW = WIDTH - AXIS_W - 16;
  const slot = plotW / steps.length;
  const xOf = (i: number) => AXIS_W + slot * (i + 0.5);
  // Puntaje 5 arriba, 1 abajo.
  const yOf = (score: number) => PLOT_TOP + PLOT_H - ((score - 1) / 4) * PLOT_H;

  const linePoints = steps.map((s, i) => `${xOf(i)},${yOf(s.score)}`).join(" ");
  const areaPoints = `${AXIS_W},${PLOT_TOP + PLOT_H} ${linePoints} ${xOf(steps.length - 1)},${PLOT_TOP + PLOT_H}`;

  const maxChars = Math.max(8, Math.floor(slot / 5.4));
  const average = steps.reduce((sum, s) => sum + s.score, 0) / steps.length;
  const weakest = steps.reduce((min, s) => (s.score < min.score ? s : min), steps[0]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full min-w-[600px]" role="img"
          aria-label="Calidad percibida de la experiencia en cada etapa del recorrido">
          {/* Bandas de fase: agrupan los pasos que pertenecen a la misma etapa. */}
          {valid.map((section, si) => {
            const indices = steps.map((s, i) => (s.sectionIndex === si ? i : -1)).filter((i) => i >= 0);
            const from = AXIS_W + slot * indices[0];
            const width = slot * indices.length;
            return (
              <g key={section.section}>
                <rect
                  x={from + 2}
                  y={PHASE_Y}
                  width={Math.max(width - 4, 10)}
                  height={PHASE_H}
                  rx={4}
                  className="fill-secondary"
                />
                <text
                  x={from + width / 2}
                  y={PHASE_Y + PHASE_H / 2 + 3.5}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] font-semibold uppercase"
                  style={{ letterSpacing: "0.06em" }}
                >
                  {section.section}
                </text>
              </g>
            );
          })}

          {/* Rejilla horizontal por puntaje, con su valor en el eje. */}
          {[1, 2, 3, 4, 5].map((score) => (
            <g key={score}>
              <line
                x1={AXIS_W}
                y1={yOf(score)}
                x2={WIDTH - 8}
                y2={yOf(score)}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray={score === 1 ? undefined : "3 4"}
              />
              <text
                x={AXIS_W - 8}
                y={yOf(score) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {score}
              </text>
            </g>
          ))}

          {/* Área + línea: la forma de la curva es el mensaje — dónde cae la experiencia. */}
          <polygon points={areaPoints} className="fill-primary" opacity={0.07} />
          <polyline points={linePoints} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" />

          {steps.map((step, i) => {
            const color = scoreColor(step.score);
            const cx = xOf(i);
            const cy = yOf(step.score);
            return (
              <g key={`${step.label}-${i}`}>
                <title>{`${step.label} — ${step.score} de 5`}</title>
                <circle cx={cx} cy={cy} r={7} fill="#ffffff" />
                <circle cx={cx} cy={cy} r={5.5} fill={color} />
                <text
                  x={cx}
                  y={cy - 12}
                  textAnchor="middle"
                  className="text-[10px] font-bold tabular-nums"
                  fill={color}
                >
                  {step.score}
                </text>
                {wrapLabel(step.label, maxChars, MAX_LABEL_LINES).map((line, li) => (
                  <text
                    key={li}
                    x={cx}
                    y={LABEL_TOP + li * LABEL_LINE_H}
                    textAnchor="middle"
                    className="fill-foreground text-[10px]"
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-xs text-muted-foreground">
        Promedio del recorrido: <strong className="text-foreground">{average.toFixed(1)} / 5</strong>. El punto
        más débil es <strong className="text-foreground">{weakest.label}</strong> ({weakest.score}/5), la etapa
        donde conviene intervenir primero.
      </p>
    </div>
  );
}
