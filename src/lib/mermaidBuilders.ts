// Los labels que entran aquí pueden venir de la IA o de URLs reales, así que hay que
// sanear cualquier caracter que rompa la sintaxis de Mermaid (comillas, corchetes, saltos de línea).
export function sanitizeMermaidLabel(raw: string, maxLength = 60): string {
  const cleaned = raw
    .replace(/["'`]/g, "")
    .replace(/[\[\]{}|]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim();

  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

function shortUrl(url: string): string {
  return sanitizeMermaidLabel(url.replace(/^https?:\/\//, "").replace(/\/$/, "") || "/");
}

function nodeId(index: number, prefix: string): string {
  return `${prefix}${index}`;
}

// Notación de flowchart "de verdad": óvalo (stadium) para inicio/fin, rectángulos para los pasos
// intermedios — así se ve como un diagrama de proceso profesional, no una simple lista de cajas.
export function buildFlowchart(steps: string[], goalLabel?: string | null): string | null {
  if (steps.length < 2) return null;

  const lines = ["flowchart TD"];
  const startId = "S_start";
  const endId = "S_end";
  const ids = steps.map((_, i) => nodeId(i, "S"));

  lines.push(`${startId}(["Inicio"])`);
  steps.forEach((step, i) => {
    lines.push(`${ids[i]}["${shortUrl(step)}"]`);
  });
  lines.push(`${endId}(["${goalLabel ? sanitizeMermaidLabel(goalLabel, 40) : "Objetivo alcanzado"}"])`);

  lines.push(`${startId} --> ${ids[0]}`);
  for (let i = 0; i < ids.length - 1; i++) {
    lines.push(`${ids[i]} --> ${ids[i + 1]}`);
  }
  lines.push(`${ids[ids.length - 1]} --> ${endId}`);

  return lines.join("\n");
}

export interface NavEdge {
  from: string;
  to: string;
}

export function buildNavGraph(edges: NavEdge[]): string | null {
  if (edges.length === 0) return null;

  const lines = ["graph TD"];
  const idFor = new Map<string, string>();
  const rootLabel = edges[0].from;
  let counter = 0;

  function idOf(label: string): string {
    if (!idFor.has(label)) {
      const id = nodeId(counter++, "N");
      idFor.set(label, id);
      // El home es el nodo raíz del sitio: óvalo, como un punto de entrada, no un paso más.
      const shape = label === rootLabel ? `(["${shortUrl(label)}"])` : `["${shortUrl(label)}"]`;
      lines.push(`${id}${shape}`);
    }
    return idFor.get(label)!;
  }

  for (const edge of edges) {
    lines.push(`${idOf(edge.from)} --> ${idOf(edge.to)}`);
  }

  return lines.join("\n");
}

export function buildPie(counts: Record<string, number>): string | null {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;

  const lines = ["pie title Problemas detectados por heurística"];
  for (const [label, count] of entries) {
    // Los nombres de heurísticas ya vienen acortados por el caller (HEURISTIC_SHORT_LABELS);
    // este límite es solo un resguardo para textos que no estén en ese mapa.
    lines.push(`"${sanitizeMermaidLabel(label, 45)}" : ${count}`);
  }

  return lines.join("\n");
}

export interface JourneyStep {
  label: string;
  score: number;
}

export interface JourneySection {
  section: string;
  steps: JourneyStep[];
}

export interface PriorityFlowchartCounts {
  critical: number;
  quickWins: number;
  highPriority: number;
}

// Árbol de decisión de triage: no lo genera la IA (así siempre es consistente y 100% correcto),
// usa la notación clásica de flowchart — óvalo inicio/fin, rombo para decisiones, rectángulo para
// acciones — igual a como se dibuja un diagrama de proceso de verdad.
export function buildPriorityFlowchart(counts: PriorityFlowchartCounts): string {
  return [
    "flowchart TD",
    'Start(["¿Cómo priorizar un hallazgo?"])',
    'Q1{"¿Es severidad 4, crítico?"}',
    `A1["Arreglar de inmediato (${counts.critical} en este informe)"]`,
    'Q2{"¿Es un quick win?"}',
    `A2["Atacar en el sprint actual (${counts.quickWins} en este informe)"]`,
    'Q3{"¿Prioridad Alta?"}',
    `A3["Planear para el próximo sprint (${counts.highPriority} en este informe)"]`,
    'A4["Backlog / mediano plazo"]',
    'End(["Hallazgo resuelto"])',
    "Start --> Q1",
    "Q1 -->|Sí| A1",
    "Q1 -->|No| Q2",
    "Q2 -->|Sí| A2",
    "Q2 -->|No| Q3",
    "Q3 -->|Sí| A3",
    "Q3 -->|No| A4",
    "A1 --> End",
    "A2 --> End",
    "A3 --> End",
    "A4 --> End",
  ].join("\n");
}

export function buildJourney(sections: JourneySection[]): string | null {
  const validSections = sections.filter((s) => s.steps.length > 0);
  if (validSections.length === 0) return null;

  const lines = ["journey", "title Experiencia del usuario"];
  for (const section of validSections) {
    lines.push(`section ${sanitizeMermaidLabel(section.section, 40)}`);
    for (const step of section.steps) {
      const score = Math.min(Math.max(Math.round(step.score), 1), 5);
      // El diagrama solo dibuja una carita según el score; sin el número al lado se pierde la
      // precisión (una carita "media" no dice si es 2 o 3), así que lo dejamos explícito en el label.
      const label = sanitizeMermaidLabel(step.label, 34);
      lines.push(`${label} (${score}/5): ${score}`);
    }
  }

  return lines.join("\n");
}
