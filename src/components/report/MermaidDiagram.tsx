import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    securityLevel: "strict",
    themeVariables: {
      // Alineado a la paleta de marca (azul primario) en vez del verde/teal por defecto de Mermaid.
      primaryColor: "#eef4fc",
      primaryTextColor: "#0b0b0b",
      primaryBorderColor: "#2a78d6",
      lineColor: "#52514e",
      secondaryColor: "#f9f9f7",
      tertiaryColor: "#ffffff",
      // Paleta categórica del pie chart (heurísticas), orden fijo validado.
      pie1: "#2a78d6",
      pie2: "#008300",
      pie3: "#e87ba4",
      pie4: "#eda100",
      pie5: "#1baf7a",
      pie6: "#eb6834",
      pie7: "#4a3aa7",
      pie8: "#e34948",
      pie9: "#184f95",
      pie10: "#0d6b0d",
      pie11: "#9085e9",
      pieOuterStrokeWidth: "1px",
      pieSectionTextColor: "#0b0b0b",
    },
  });
  initialized = true;
}

export default function MermaidDiagram({ chart, title }: { chart: string | null; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    if (!chart || !containerRef.current) return;

    ensureInitialized();
    let cancelled = false;

    mermaid
      .render(`mermaid-${id}`, chart)
      .then(({ svg }) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(false);
        }
      })
      .catch((err) => {
        console.error(`MermaidDiagram (${title}): fallo al renderizar`, err);
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [chart, id, title]);

  if (!chart) return null;

  if (error) {
    return <p className="text-sm text-muted-foreground">No se pudo generar el diagrama de "{title}".</p>;
  }

  return <div ref={containerRef} className="overflow-x-auto [&_svg]:mx-auto" />;
}
