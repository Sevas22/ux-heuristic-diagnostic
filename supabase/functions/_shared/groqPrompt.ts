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
  /** Frase de apertura para lectura directiva. Opcional: los informes previos no la tienen. */
  headline?: string;
  general_assessment: string;
  strengths: string[];
  weaknesses: string[];
}

export interface Methodology {
  flow_analyzed: string;
  criteria: string;
}

/** Qué tan extendido está el problema dentro del sitio. */
export const FREQUENCIES = ["Aislado", "Recurrente", "Sistémico"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
/** Esfuerzo de implementación estimado por un equipo de producto. */
export const EFFORTS = ["Bajo", "Medio", "Alto"] as const;
export type Effort = (typeof EFFORTS)[number];

export interface Finding {
  id: string;
  screen: string;
  heuristic: string;
  severity: number;
  impact_score: number;
  description: string;
  /** Causa raíz: por qué se produce, no solo qué se ve. */
  root_cause: string;
  user_impact: string;
  /** Consecuencia para el negocio, en términos defendibles (sin cifras inventadas). */
  business_impact: string;
  /** Recomendación a nivel de especificación: qué cambiar, dónde y con qué criterio. */
  recommendation: string;
  priority: "Alta" | "Media" | "Baja";
  frequency: Frequency;
  effort: Effort;
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

NIVEL DE PROFUNDIDAD ESPERADO (esto separa una auditoría de consultoría de una lista genérica):
- Escribe como un consultor senior que debe defender cada afirmación frente al comité de dirección del cliente. Nada de obviedades ni de consejos que servirían para cualquier sitio del mundo.
- "description" NO es "la página carece de jerarquía". Es qué elemento concreto, dónde, y qué principio de usabilidad se está incumpliendo.
- "root_cause" explica POR QUÉ ocurre (decisión de diseño, patrón mal aplicado, falta de jerarquía visual, contenido que compite entre sí...), no repite el síntoma.
- "business_impact" traduce el problema a consecuencia de negocio EN TÉRMINOS CUALITATIVOS DEFENDIBLES ligados al objetivo declarado por el cliente. Ejemplo válido: "El único camino hacia el contacto compite con otros tres elementos del mismo peso visual, así que la intención de conversión se diluye justo en el punto de decisión". PROHIBIDO inventar cifras: nunca escribas porcentajes de conversión, rebote, tiempos o cualquier número que no te hayamos dado como dato medido. No tenemos analítica del sitio; un número inventado destruye la credibilidad de todo el informe.
- "recommendation" debe ser una ESPECIFICACIÓN ejecutable, no una intención. Mal: "mejorar el CTA". Bien: "un único CTA primario sobre el pliegue, con contraste mínimo 4.5:1, y degradar los otros dos enlaces de esa zona a estilo secundario para que no compitan". Di qué elemento, dónde, con qué jerarquía y bajo qué criterio verificable.
- No compares con sitios que no estén en la lista de referencias que te dieron. Si tienes descripción visual de una referencia, la comparación debe apoyarse en ella; si no, no cites empresas ni "buenas prácticas del sector" como si las hubieras observado.

EJEMPLO DEL NIVEL EXIGIDO. Este es el contraste entre un hallazgo inaceptable y uno aceptable:

RECHAZADO (esto es lo que NO debes escribir — vale para cualquier sitio, no dice nada):
  description: "La página de inicio es muy larga y contiene mucha información, lo que puede ser abrumador."
  root_cause: "Falta de claridad en la jerarquía visual."
  business_impact: "Puede obstaculizar la conversión de visitantes en contactos."
  recommendation: "Reducir la cantidad de información y enfocarse en un llamado a la acción claro y prominente."
Por qué se rechaza: "root_cause" repite el síntoma en vez de explicar la causa; nada cita elementos reales; la recomendación no dice qué elemento, dónde ni con qué criterio; se podría copiar y pegar en el informe de cualquier otro cliente.

ACEPTADO (este es el nivel esperado — cita elementos reales y es ejecutable):
  description: "En la franja superior conviven cuatro llamadas a la acción con el mismo peso visual ('Agenda tu diagnóstico', 'Ver servicios', 'Conoce al equipo' y el buscador), sin que ninguna destaque como acción principal. Incumple la heurística de diseño estético y minimalista: el usuario debe evaluar cuatro opciones antes de decidir."
  root_cause: "Todas las secciones del sitio reclamaron presencia en el área superior y se resolvió dándoles el mismo tratamiento visual, en lugar de definir una única acción primaria alineada al objetivo de negocio."
  business_impact: "El objetivo declarado es que más visitantes contacten, pero el camino hacia el contacto no tiene prioridad visual sobre alternativas que no convierten: la intención se dispersa justo en el punto de decisión."
  recommendation: "Dejar 'Agenda tu diagnóstico' como único botón primario en la franja superior, con color de marca sólido y contraste mínimo 4.5:1. Degradar 'Ver servicios' y 'Conoce al equipo' a enlaces de texto secundarios, y mover el buscador al encabezado. Verificable: un solo elemento con relleno sólido por encima del pliegue."

Aplica este nivel a TODOS los hallazgos. Si para un hallazgo no puedes escribir algo así de específico con la evidencia disponible, descártalo y genera uno del que sí puedas.

LÍMITE DE LA ESPECIFICIDAD: "específico" significa describir el cambio en términos de lo que el usuario VE y de criterios verificables (posición respecto del pliegue, jerarquía entre elementos, ratio de contraste, cantidad de opciones simultáneas, orden de lectura). NO inventes detalles técnicos que no puedas conocer: nunca cites nombres de clases CSS, IDs, selectores, códigos hexadecimales de color, ni valores de padding o tipografía del sitio — no tenemos su código fuente. Escribe "el botón principal de la franja superior", no ".btn-primary"; escribe "contraste mínimo 4.5:1 sobre su fondo", no "color #0066CC".

Reglas importantes:
- No inventes pantallas ni pasos que no puedas justificar con las capturas o el contexto dado.
- "screen" en cada hallazgo debe ser una de las URLs de páginas capturadas que se te dan, o "General" si el problema aplica a todo el sitio.
- Genera entre 5 y 6 hallazgos, los más importantes. Vale mucho más un informe de 5 hallazgos con el nivel del EJEMPLO ACEPTADO que uno de 10 superficiales: la profundidad es el entregable, no la cantidad.
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

Escala de frecuencia ("frequency") — qué tan extendido está el problema:
- "Aislado": ocurre en un punto concreto de una sola pantalla.
- "Recurrente": se repite en varias secciones o pantallas.
- "Sistémico": es un patrón transversal a todo el sitio (afecta el sistema de diseño, la navegación global o la estructura).

Escala de esfuerzo ("effort") — costo de implementación para un equipo de producto:
- "Bajo": cambio de copy, color, tamaño o posición de un elemento existente. Horas.
- "Medio": rediseño de un componente o sección, o cambios que tocan varias pantallas. Días.
- "Alto": requiere rediseño estructural, cambios de arquitectura de información o desarrollo nuevo. Semanas.
Sé honesto con el esfuerzo: marcar todo como "Bajo" hace inútil la priorización.

Responde ÚNICAMENTE con este JSON, sin texto adicional:
{
  "overall_score": number 0-100,
  "executive_summary": {
    "product_description": string (2-3 frases: qué es el producto),
    "analysis_objective": string (1-2 frases, según el objetivo del solicitante),
    "headline": string (UNA frase para un director: problema dominante + consecuencia para su objetivo),
    "general_assessment": string (3-5 frases para comité de dirección: estado, patrón de fondo, qué hay en juego),
    "strengths": string[] (3-5), "weaknesses": string[] (3-5)
  },
  "methodology": { "flow_analyzed": string, "criteria": string },
  "findings": [{
    "id": "H-01"..., "screen": string (URL capturada o "General"),
    "heuristic": string (heurística de Nielsen exacta, en español),
    "severity": number 0-4, "impact_score": number 0-1,
    "description": string (2-3 frases: qué elemento falla, dónde, qué principio incumple),
    "root_cause": string (1-2 frases: la decisión de diseño detrás, NUNCA el síntoma),
    "user_impact": string (1-2 frases),
    "business_impact": string (1-2 frases, cualitativo, SIN cifras),
    "recommendation": string (2-3 frases, nivel especificación, criterio verificable),
    "priority": "Alta"|"Media"|"Baja", "frequency": "Aislado"|"Recurrente"|"Sistémico",
    "effort": "Bajo"|"Medio"|"Alto", "zone": string|null,
    "evidence_ref": string (ver REGLA DE EVIDENCIA)
  }],
  "user_flow": string[] (URLs capturadas en orden lógico),
  "journey_map": [{ "section": string, "steps": [{ "label": string, "score": number 1-5 }] }],
  "conclusions": {
    "risks": string[] (2-4), "quick_wins": string[] (3-5),
    "mid_term": string[] (2-4), "strategic_recommendations": string[] (2-3),
    "final_score": number 0-100
  }
}
Heurísticas de Nielsen: ${NIELSEN_HEURISTICS.join(", ")}.`;

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

    // Campos de análisis: si el modelo los omite o los devuelve fuera de escala, se normalizan en
    // vez de tirar el informe entero. El valor por defecto es el más conservador de cada escala:
    // asumir "Aislado"/"Medio" no infla la urgencia ni promete que el arreglo sea barato.
    f.root_cause = typeof f.root_cause === "string" ? f.root_cause : "";
    f.business_impact = typeof f.business_impact === "string" ? f.business_impact : "";
    f.frequency = FREQUENCIES.includes(f.frequency) ? f.frequency : "Aislado";
    f.effort = EFFORTS.includes(f.effort) ? f.effort : "Medio";
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
