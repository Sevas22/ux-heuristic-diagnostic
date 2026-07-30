import type { Finding } from "./groqPrompt.ts";

// Lo que Groq recibió como evidencia real — un finding solo sobrevive si su evidence_ref
// (y cualquier texto entre comillas en su descripción/recomendación) se puede verificar contra esto.
export interface EvidenceBundle {
  headings: string[];
  ctas: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  hasScreenshot: boolean;
  visualDescription: string | null;
}

// La comparación existe para detectar citas INVENTADAS, no para castigar diferencias de tipografía.
// Los CTAs reales traen emoji, tildes y mayúsculas ("🔍 DIAGNÓSTICO SEO-GEO") que el modelo
// reproduce de forma aproximada; comparar en crudo descartaba hallazgos legítimos por una tilde.
// Se normaliza a letras y números sin acentos para que solo sobreviva la diferencia real de fondo.
function normalize(text: string): string {
  return text
    .normalize("NFD")
    // Marcas diacríticas combinantes (U+0300–U+036F): escritas con \u para que el rango no se
    // corrompa al guardar el archivo con otra codificación.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function verifyEvidenceRef(ref: string, bundle: EvidenceBundle): boolean {
  if (ref === "screenshot") return bundle.hasScreenshot;
  if (ref === "meta:title") return Boolean(bundle.metaTitle);
  if (ref === "meta:description") return Boolean(bundle.metaDescription);
  // Los hallazgos de accesibilidad los generamos nosotros mismos a partir de axe-core (evidence_ref
  // = "axe:<id de regla>"), nunca los inventa el modelo — no necesitan re-verificarse aquí.
  if (ref.startsWith("axe:")) return true;

  if (ref.startsWith("heading:")) {
    return matchesAny(ref.slice("heading:".length), bundle.headings);
  }
  if (ref.startsWith("cta:")) {
    return matchesAny(ref.slice("cta:".length), bundle.ctas);
  }

  return false;
}

// Coincidencia por contención en ambos sentidos, no igualdad estricta. El modelo suele citar una
// versión recortada del texto real ("Creamos el futuro" por "Creamos el futuro en cada desarrollo")
// y exigir igualdad descartaba hallazgos legítimos sobre contenido que SÍ existe en el sitio.
// Se mantiene la garantía de fondo: la cita tiene que corresponder a texto realmente capturado.
const MIN_MATCH_CHARS = 6;

function matchesAny(cited: string, candidates: string[]): boolean {
  const needle = normalize(cited);
  if (needle.length < MIN_MATCH_CHARS) {
    // Citas muy cortas ("Ver", "Menú") harían match con casi cualquier cosa: se exige igualdad.
    return candidates.some((c) => normalize(c) === needle);
  }
  return candidates.some((c) => {
    const hay = normalize(c);
    return hay.includes(needle) || needle.includes(hay);
  });
}

// El modelo a veces "decora" un hallazgo genérico con una cita entre comillas que suena real
// pero no lo es. Cualquier texto citado debe aparecer literalmente en la evidencia real que le dimos.
function verifyQuotedText(text: string, bundle: EvidenceBundle): boolean {
  const haystack = normalize(
    [...bundle.headings, ...bundle.ctas, bundle.metaTitle ?? "", bundle.metaDescription ?? "", bundle.visualDescription ?? ""].join(" \n "),
  );

  const quotes = [...text.matchAll(/["“]([^"”]{4,80})["”]/g)]
    .map((m) => normalize(m[1]))
    .filter((q) => q.length >= 4);

  return quotes.every((q) => haystack.includes(q));
}

export interface PruneResult {
  kept: Finding[];
  dropped: Finding[];
  reasons: string[];
}

// Poda (no rechaza el informe entero) los hallazgos que citan evidencia inventada. Preferimos
// un informe más corto pero 100% verificable a fallar del todo por unos pocos hallazgos flojos.
export function pruneUnverifiedFindings(findings: Finding[], bundle: EvidenceBundle): PruneResult {
  const kept: Finding[] = [];
  const dropped: Finding[] = [];
  const reasons: string[] = [];

  for (const finding of findings) {
    // La garantía que importa es que el hallazgo APUNTE a evidencia real: eso es lo que se muestra
    // al cliente en la línea "Evidencia" y lo que hace auditable el informe. Se sigue exigiendo.
    const evidenceOk = verifyEvidenceRef(finding.evidence_ref, bundle);

    if (!evidenceOk) {
      dropped.push(finding);
      reasons.push(`${finding.id}: evidence_ref "${finding.evidence_ref}" no corresponde a evidencia real`);
      continue;
    }

    // El chequeo de comillas era una segunda barrera pensada para citas fabricadas. Con análisis
    // más extensos empezó a hacer más daño que bien: descartaba hallazgos válidos porque el modelo
    // parafraseaba media frase de la descripción visual, dejando informes de un solo hallazgo.
    // Se conserva como señal en los logs, pero ya no elimina el hallazgo.
    if (!verifyQuotedText(finding.description, bundle) || !verifyQuotedText(finding.recommendation, bundle)) {
      reasons.push(`${finding.id}: se conserva, pero cita texto que no aparece literal en la evidencia`);
    }

    kept.push(finding);
  }

  return { kept, dropped, reasons };
}

// Evita el "8.7/10 injustificado": si sobrevivieron varios hallazgos críticos/importantes tras la
// poda, el score general no puede quedar artificialmente alto solo porque el modelo lo redactó así.
export function coherentScore(findings: Finding[], modelScore: number): number {
  const criticalCount = findings.filter((f) => f.severity === 4).length;
  const seriousCount = findings.filter((f) => f.severity === 3).length;
  const ceiling = Math.max(20, 100 - criticalCount * 15 - seriousCount * 8);
  return Math.min(modelScore, ceiling);
}
