// Traduce el evidence_ref crudo (formato interno usado para validar contra la evidencia real
// en generate-report) a una frase legible que refuerza que el hallazgo está respaldado, no inventado.
export function describeEvidenceRef(ref: string): string {
  if (ref === "screenshot") return "captura de pantalla real del sitio";
  if (ref.startsWith("heading:")) return `encabezado real: "${ref.slice("heading:".length)}"`;
  if (ref.startsWith("cta:")) return `botón/CTA real: "${ref.slice("cta:".length)}"`;
  if (ref === "meta:title") return "título real de la página";
  if (ref === "meta:description") return "descripción real de la página";
  if (ref.startsWith("axe:")) return `regla de accesibilidad axe-core (${ref.slice("axe:".length)})`;
  return ref;
}
