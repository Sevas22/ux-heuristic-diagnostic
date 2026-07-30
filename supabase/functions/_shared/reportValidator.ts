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
    const text = normalize(ref.slice("heading:".length));
    return bundle.headings.some((h) => normalize(h) === text);
  }
  if (ref.startsWith("cta:")) {
    const text = normalize(ref.slice("cta:".length));
    return bundle.ctas.some((c) => normalize(c) === text);
  }

  return false;
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
    const evidenceOk = verifyEvidenceRef(finding.evidence_ref, bundle);
    const quotesOk = evidenceOk && verifyQuotedText(finding.description, bundle) && verifyQuotedText(finding.recommendation, bundle);

    if (evidenceOk && quotesOk) {
      kept.push(finding);
    } else {
      dropped.push(finding);
      reasons.push(
        `${finding.id}: evidence_ref "${finding.evidence_ref}" ${evidenceOk ? "no se pudo verificar el texto citado" : "no corresponde a evidencia real"}`,
      );
    }
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
