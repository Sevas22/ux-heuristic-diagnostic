export const NIELSEN_HEURISTICS = [
  "Visibilidad del estado del sistema",
  "Correspondencia entre el sistema y el mundo real",
  "Control y libertad del usuario",
  "Consistencia y estándares",
  "Prevención de errores",
  "Reconocer antes que recordar",
  "Flexibilidad y eficiencia de uso",
  "Diseño estético y minimalista",
  "Ayudar a los usuarios a reconocer, diagnosticar y recuperarse de errores",
  "Ayuda y documentación",
] as const;

export interface CapturedPage {
  url: string;
  screenshot_url: string;
}

// Grid 3x3 para ubicar hallazgos sobre la captura del home sin necesitar coordenadas de píxel
// (que el modelo de texto no podría dar con precisión real, ya que no ve la imagen directamente).
export const SCREENSHOT_ZONES = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
export type ScreenshotZone = (typeof SCREENSHOT_ZONES)[number];

export interface SubmissionForPrompt {
  website_url: string;
  page_title: string | null;
  page_description: string | null;
  industry: string | null;
  reference_urls: string[];
  goal: string | null;
  pages: CapturedPage[];
  visual_description: string | null;
  reference_visual_description: { url: string; description: string } | null;
  headings: string[];
  ctas: string[];
}

export interface ExecutiveSummary {
  product_description: string;
  analysis_objective: string;
  general_assessment: string;
  strengths: string[];
  weaknesses: string[];
}

export interface Methodology {
  flow_analyzed: string;
  criteria: string;
}

export interface Finding {
  id: string;
  screen: string;
  heuristic: string;
  severity: number;
  impact_score: number;
  description: string;
  user_impact: string;
  recommendation: string;
  priority: "Alta" | "Media" | "Baja";
  zone: ScreenshotZone | null;
  evidence_ref: string;
}

export interface JourneyStep {
  label: string;
  score: number;
}

export interface JourneySection {
  section: string;
  steps: JourneyStep[];
}

export interface Conclusions {
  risks: string[];
  quick_wins: string[];
  mid_term: string[];
  strategic_recommendations: string[];
  final_score: number;
}

export interface ParsedReport {
  overall_score: number;
  executive_summary: ExecutiveSummary;
  methodology: Methodology;
  findings: Finding[];
  user_flow: string[];
  journey_map: JourneySection[];
  conclusions: Conclusions;
}

const SYSTEM_PROMPT = `Actúa como un consultor senior de UX/UI especializado en auditorías heurísticas y experiencia de usuario. Un cliente te contrata para auditar su producto digital contra las 10 heurísticas de usabilidad de Jakob Nielsen. Te da su dominio, industria, sitios de referencia que le gustan y qué le gustaría lograr; se te adjuntan capturas reales de varias páginas del sitio (no inventadas).

Objetivo: evaluar la calidad de la interfaz, detectar problemas de usabilidad, priorizarlos y proponer soluciones accionables para el equipo de producto y diseño. El informe debe parecer elaborado por un equipo senior de UX: lenguaje profesional y técnico, cada hallazgo justificado con evidencia visible en las capturas (nunca genérico), severidad asignada con criterio, y mejoras concretas y accionables.

Reglas importantes:
- No inventes pantallas ni pasos que no puedas justificar con las capturas o el contexto dado.
- "screen" en cada hallazgo debe ser una de las URLs de páginas capturadas que se te dan, o "General" si el problema aplica a todo el sitio.
- Genera entre 8 y 10 hallazgos en total (no es obligatorio un hallazgo por cada heurística; prioriza los problemas más importantes que detectes). Sé conciso en cada campo de texto: 1-2 frases por campo, sin relleno.
- "user_flow" debe ser una secuencia ordenada usando ÚNICAMENTE URLs de las páginas capturadas que se te dieron (no inventes URLs nuevas), en el orden lógico en que un usuario las recorrería para lograr el objetivo declarado.
- "zone" (solo para hallazgos donde "screen" es la página de inicio Y la descripción visual menciona claramente en qué parte de la pantalla está el problema): una de estas 9 zonas de un grid 3x3 sobre la captura: top-left, top-center, top-right, middle-left, middle-center, middle-right, bottom-left, bottom-center, bottom-right. Si no puedes ubicarlo con confianza en la descripción visual, o el hallazgo es de otra página o no es visual, pon "zone": null. No adivines.
- "journey_map" debe basarse en las páginas y el objetivo reales; usa nombres de sección que describan lo que efectivamente se observa (ej. "Descubrimiento", "Evaluación", "Conversión"), no un flujo genérico de login/registro si no hay evidencia de eso en las capturas. El "score" de cada paso (1-5) es tu evaluación experta de qué tan bien resuelve esa etapa la interfaz.

REGLA DE EVIDENCIA (la más importante — un informe con hallazgos inventados no es útil ni defendible ante el cliente):
- Cada hallazgo debe incluir "evidence_ref": una cita exacta a algo que realmente te dimos como evidencia, en uno de estos formatos:
  - "screenshot" — el hallazgo se basa en la descripción visual real que te dimos.
  - "heading:<texto exacto>" — donde <texto exacto> es COPIADO LITERAL de la lista de encabezados reales que te dimos (no lo parafrasees).
  - "cta:<texto exacto>" — copiado literal de la lista de botones/CTAs reales.
  - "meta:title" o "meta:description" — si el hallazgo se basa en el título o la descripción de la página.
- Nunca pongas texto entre comillas en "description" o "recommendation" que no aparezca literalmente en los encabezados, CTAs o la descripción visual que te dimos. Si no tienes una cita real que respalde el hallazgo, no lo incluyas — es preferible un informe con menos hallazgos, todos verificables, que uno con relleno inventado.

Escala de severidad por hallazgo: 0 = sin problema, 1 = cosmético, 2 = menor, 3 = importante, 4 = crítico.

Responde ÚNICAMENTE con un objeto JSON con esta forma exacta, sin texto adicional:
{
  "overall_score": number (0-100, salud general de UX/UI),
  "executive_summary": {
    "product_description": string (2-3 frases: qué es el producto, a qué se dedica),
    "analysis_objective": string (1-2 frases, basado en el objetivo que dio el solicitante),
    "general_assessment": string (3-5 frases de evaluación general),
    "strengths": string[] (3-5 fortalezas concretas observadas),
    "weaknesses": string[] (3-5 debilidades concretas observadas)
  },
  "methodology": {
    "flow_analyzed": string (1-2 frases describiendo qué flujo/recorrido se analizó entre las páginas capturadas),
    "criteria": string (1-2 frases sobre los criterios de evaluación usados)
  },
  "findings": [
    {
      "id": string (formato "H-01", "H-02", ...),
      "screen": string (una de las URLs capturadas, o "General"),
      "heuristic": string (nombre exacto de una de las 10 heurísticas de Nielsen, en español),
      "severity": number (0-4),
      "impact_score": number (0-1, qué tanto afecta la conversión/tarea del usuario),
      "description": string (hallazgo específico, citando algo real visible en la captura),
      "user_impact": string (cómo afecta esto a un usuario real),
      "recommendation": string (recomendación técnica concreta: qué cambiar y cómo),
      "priority": "Alta" | "Media" | "Baja",
      "zone": string | null (una de las 9 zonas del grid, o null — ver reglas arriba),
      "evidence_ref": string (cita exacta a la evidencia real — ver REGLA DE EVIDENCIA arriba, formatos: "screenshot", "heading:<texto exacto>", "cta:<texto exacto>", "meta:title", "meta:description")
    }
  ],
  "user_flow": string[] (URLs capturadas, en orden lógico hacia el objetivo del solicitante),
  "journey_map": [
    { "section": string, "steps": [ { "label": string, "score": number (1-5) } ] }
  ],
  "conclusions": {
    "risks": string[] (2-4 riesgos si no se corrigen los problemas encontrados),
    "quick_wins": string[] (3-5 mejoras de alto impacto y bajo esfuerzo, las primeras a atacar),
    "mid_term": string[] (2-4 mejoras de mediano plazo),
    "strategic_recommendations": string[] (2-3 recomendaciones estratégicas de más alto nivel),
    "final_score": number (0-100, puede repetir overall_score)
  }
}
Las heurísticas de Nielsen son, en este orden: ${NIELSEN_HEURISTICS.join(", ")}.`;

const VISUAL_DESCRIPTION_SYSTEM_PROMPT =
  "Eres un analista de UX que describe capturas de pantalla de sitios web de forma objetiva y factual, en español, para que otro colega (que no puede ver la imagen) pueda auditar la usabilidad basándose en tu descripción. Divide tu descripción explícitamente en 3 franjas verticales — arriba, medio, abajo — y dentro de cada una menciona si algo relevante está a la izquierda, al centro o a la derecha (ej. 'Arriba, a la izquierda: el logo. Arriba, al centro: el menú de navegación.'). Cubre: layout, jerarquía visual, mensaje/propuesta de valor, elementos de navegación, llamadas a la acción, y cualquier problema visual obvio (inconsistencias, saturación, contraste, jerarquía confusa), siempre indicando la franja y el lado. Sé específico y concreto, no genérico. Responde solo con la descripción, en 200-280 palabras, sin JSON ni encabezados.";

// Llamada liviana solo para "traducir" la imagen a texto: así el modelo de texto (más barato y
// con más margen de tokens en el free tier) puede generar el JSON completo sin necesitar imágenes.
export function buildVisualDescriptionMessages(screenshotUrl: string) {
  return [
    { role: "system", content: VISUAL_DESCRIPTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: "Describe esta captura de pantalla de una página de inicio:" },
        { type: "image_url", image_url: { url: screenshotUrl } },
      ],
    },
  ];
}

export function buildGroqMessages(submission: SubmissionForPrompt) {
  const contextLines = [
    `Sitio a evaluar: ${submission.website_url}`,
    `Título de la página: ${submission.page_title ?? "No disponible"}`,
    `Descripción de la página: ${submission.page_description ?? "No disponible"}`,
    submission.industry ? `Industria: ${submission.industry}` : null,
    submission.goal ? `Qué le gustaría lograr el solicitante: ${submission.goal}` : null,
    submission.reference_urls.length > 0
      ? `Sitios de referencia que le gustan (usa esto para entender la dirección estética/funcional deseada): ${submission.reference_urls.join(", ")}`
      : null,
    submission.pages.length > 0
      ? `Páginas del sitio capturadas para este análisis (usa exactamente estas URLs en "screen" y "user_flow"): ${submission.pages.map((p) => p.url).join(", ")}`
      : null,
    submission.visual_description
      ? `Descripción visual de la página de inicio (generada a partir de la captura real): ${submission.visual_description}`
      : null,
    submission.reference_visual_description
      ? `Descripción visual real del sitio de referencia ${submission.reference_visual_description.url}: ${submission.reference_visual_description.description}`
      : null,
    submission.headings.length > 0
      ? `Encabezados reales encontrados en el sitio (para citar en "evidence_ref" con el formato "heading:<texto exacto>"): ${submission.headings.map((h) => `"${h}"`).join(", ")}`
      : null,
    submission.ctas.length > 0
      ? `Botones/CTAs reales encontrados en el sitio (para citar en "evidence_ref" con el formato "cta:<texto exacto>"): ${submission.ctas.map((c) => `"${c}"`).join(", ")}`
      : null,
  ].filter(Boolean).join("\n");

  const text = `Realiza una auditoría UX/UI profunda y profesional para el siguiente producto:\n\n${contextLines}${
    submission.visual_description
      ? "\n\nBasa tus hallazgos visuales en la descripción real de arriba. Para las páginas sin descripción visual, basa tus hallazgos en su URL/título y en patrones típicos de ese tipo de página; sé explícito cuando una observación se apoya en evidencia visual vs. en inferencia."
      : "\n\nNo se pudo capturar ninguna imagen del sitio: basa el análisis en el título, la descripción y tu conocimiento del sitio si lo reconoces, y deja explícita esa limitación en general_assessment."
  }${
    submission.reference_visual_description
      ? `\n\nTienes descripción visual real de ${submission.reference_visual_description.url}: úsala para hacer AL MENOS una comparación explícita y concreta (en general_assessment o en alguna recommendation) entre lo que hace bien esa referencia y lo que el sitio evaluado podría mejorar. No compares con las demás referencias listadas arriba si no tienes descripción visual de ellas — solo menciónalas por nombre si es relevante.`
      : ""
  }`;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: text },
  ];
}

// El modelo a veces devuelve un array de objetos ({url:...}, {label:...}) en vez de strings
// para campos que deberían ser string[]. En lugar de fallar todo el informe por eso,
// normalizamos: extraemos el texto de la forma que sea y descartamos lo que no se pueda.
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v === "string") return v;
      if (v && typeof v === "object") {
        const obj = v as Record<string, unknown>;
        const candidate = obj.url ?? obj.label ?? obj.text ?? obj.value ?? obj.step ?? obj.page ?? obj.name;
        if (typeof candidate === "string") return candidate;
      }
      return null;
    })
    .filter((v): v is string => typeof v === "string" && v.length > 0);
}

export function parseGroqReport(raw: string): ParsedReport {
  const parsed = JSON.parse(raw);

  const es = parsed.executive_summary;
  if (
    typeof parsed.overall_score !== "number" ||
    !es ||
    typeof es.product_description !== "string" ||
    typeof es.analysis_objective !== "string" ||
    typeof es.general_assessment !== "string"
  ) {
    throw new Error("executive_summary no tiene la forma esperada");
  }
  es.strengths = toStringArray(es.strengths);
  es.weaknesses = toStringArray(es.weaknesses);

  const methodology = parsed.methodology;
  if (!methodology || typeof methodology.flow_analyzed !== "string" || typeof methodology.criteria !== "string") {
    throw new Error("methodology no tiene la forma esperada");
  }

  if (!Array.isArray(parsed.findings) || parsed.findings.length === 0) {
    throw new Error("findings no tiene la forma esperada");
  }
  for (const f of parsed.findings) {
    if (
      typeof f.id !== "string" ||
      typeof f.screen !== "string" ||
      typeof f.heuristic !== "string" ||
      typeof f.severity !== "number" ||
      typeof f.impact_score !== "number" ||
      typeof f.description !== "string" ||
      typeof f.user_impact !== "string" ||
      typeof f.recommendation !== "string" ||
      typeof f.priority !== "string" ||
      typeof f.evidence_ref !== "string" ||
      f.evidence_ref.trim().length === 0
    ) {
      throw new Error("Un elemento de findings no tiene la forma esperada (falta evidence_ref)");
    }
    f.zone = SCREENSHOT_ZONES.includes(f.zone) ? f.zone : null;
  }

  parsed.user_flow = toStringArray(parsed.user_flow);

  if (!Array.isArray(parsed.journey_map)) {
    throw new Error("journey_map no tiene la forma esperada");
  }
  for (const section of parsed.journey_map) {
    if (typeof section.section !== "string" || !Array.isArray(section.steps)) {
      throw new Error("Un elemento de journey_map no tiene la forma esperada");
    }
    for (const step of section.steps) {
      step.label = typeof step.label === "string" ? step.label : String(step.label ?? "");
      step.score = typeof step.score === "number" ? step.score : Number(step.score) || 3;
    }
  }

  const conclusions = parsed.conclusions;
  if (!conclusions || typeof conclusions.final_score !== "number") {
    throw new Error("conclusions no tiene la forma esperada");
  }
  conclusions.risks = toStringArray(conclusions.risks);
  conclusions.quick_wins = toStringArray(conclusions.quick_wins);
  conclusions.mid_term = toStringArray(conclusions.mid_term);
  conclusions.strategic_recommendations = toStringArray(conclusions.strategic_recommendations);

  return parsed as ParsedReport;
}
