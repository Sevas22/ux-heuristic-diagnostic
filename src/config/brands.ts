/**
 * Registro de marcas.
 *
 * Esta app se embebe vía <iframe> en sitios de agencias distintas. Para que el mismo
 * despliegue sirva a varias, todo lo que cambia entre una y otra vive acá: paleta,
 * tipografía y textos. La marca se elige con el parámetro `?brand=` en la URL del iframe:
 *
 *   <iframe src="https://ux-heuristic-diagnostic-2qv6.vercel.app/?brand=idp"></iframe>
 *
 * Ojo con el dominio: el frontend es el proyecto `-2qv6`. `ux-heuristic-diagnostic.vercel.app`
 * (sin sufijo) es el microservicio de evidencia, que solo expone /api/inspect y responde 404
 * en la raíz.
 *
 * Para sumar una agencia nueva no hay que tocar ningún componente: se agrega una entrada
 * a BRANDS y se apunta el iframe a su id.
 */

/** Tokens de color en formato HSL sin la función `hsl()`, tal como los consume Tailwind. */
type Tokens = Record<string, string>;

export interface BrandCopy {
  /** Etiqueta pequeña sobre el título. */
  eyebrow: string;
  /** Título del hero. `titleHighlight` se pinta con el color de acento. */
  title: string;
  titleHighlight: string;
  subtitle: string;
  ctaPrimary: string;
  /** Micro-garantías bajo el CTA: quitan fricción antes de pedir datos. */
  reassurances: string[];
  stepsTitle: string;
  steps: { title: string; description: string }[];
  deliverablesTitle: string;
  deliverablesSubtitle: string;
  deliverables: { title: string; description: string }[];
  heuristicsTitle: string;
  heuristicsSubtitle: string;
  closingTitle: string;
  closingSubtitle: string;
  /** Enlace opcional de contacto en el cierre; si falta, no se muestra el botón. */
  contactLabel?: string;
  contactUrl?: string;
  footerNote: string;
}

export interface Brand {
  id: string;
  /** Nombre visible en el encabezado y el pie. */
  name: string;
  /** Encabezado propio. Se apaga cuando el sitio anfitrión ya tiene su propia navegación. */
  showHeader: boolean;
  /** Logo opcional; si falta se usa el nombre en texto. */
  logoUrl?: string;
  tokens: Tokens;
  copy: BrandCopy;
}

/**
 * Contenido de producto compartido: describe el servicio, no a la agencia. Cada marca
 * puede pisar lo que quiera con un spread.
 */
const BASE_COPY: BrandCopy = {
  eyebrow: "Diagnóstico automatizado",
  title: "Descubre qué está frenando a los usuarios de tu",
  titleHighlight: "sitio web",
  subtitle:
    "Analizamos tu sitio con las 10 heurísticas de Nielsen y te entregamos un informe con evidencia real: capturas, métricas de rendimiento y accesibilidad, y un plan de mejoras priorizado.",
  ctaPrimary: "Analizar mi sitio",
  reassurances: [
    "Resultados en minutos",
    "Evidencia real, no opiniones",
    "Informe descargable en PDF",
  ],
  stepsTitle: "Cómo funciona",
  steps: [
    {
      title: "Cuéntanos tu contexto",
      description:
        "Tu dominio, tu industria, los sitios que te gustan y qué quieres lograr. Toma menos de dos minutos.",
    },
    {
      title: "Analizamos tu sitio de verdad",
      description:
        "Abrimos tu página en un navegador real: capturamos pantalla, medimos rendimiento y detectamos barreras de accesibilidad.",
    },
    {
      title: "Recibes tu informe",
      description:
        "Hallazgos priorizados por impacto y esfuerzo, con recomendaciones concretas y una hoja de ruta por fases.",
    },
  ],
  deliverablesTitle: "Qué recibes",
  deliverablesSubtitle: "Un informe de consultoría, no un checklist genérico.",
  deliverables: [
    {
      title: "Resumen ejecutivo",
      description: "El estado de tu sitio en una página, escrito para quien decide el presupuesto.",
    },
    {
      title: "Hallazgos con evidencia",
      description:
        "Cada problema citado contra algo real de tu sitio: un título, un botón, una captura.",
    },
    {
      title: "Métricas de rendimiento",
      description: "Velocidad, accesibilidad y SEO medidos en móvil y escritorio con Lighthouse.",
    },
    {
      title: "Auditoría de accesibilidad",
      description:
        "Barreras WCAG detectadas automáticamente, explicadas en español y con su solución.",
    },
    {
      title: "Matriz impacto vs. esfuerzo",
      description: "Qué arreglar primero para ganar más con menos trabajo.",
    },
    {
      title: "Hoja de ruta por fases",
      description: "Un plan realista de mejoras, ordenado y estimado.",
    },
  ],
  heuristicsTitle: "Evaluamos las 10 heurísticas de Nielsen",
  heuristicsSubtitle:
    "El estándar de la industria para medir usabilidad, aplicado punto por punto a tu producto.",
  closingTitle: "¿Listo para ver tu sitio con otros ojos?",
  closingSubtitle: "Empieza el diagnóstico ahora y recibe tu informe en minutos.",
  footerNote: "Diagnóstico UX/UI basado en las heurísticas de Jakob Nielsen.",
};

/** Paleta neutra por defecto: la base sobre la que cada marca pisa lo que necesita. */
const DEFAULT_TOKENS: Tokens = {
  "--background": "0 0% 100%",
  "--foreground": "222 30% 14%",
  "--surface": "210 40% 97%",
  "--ink": "222 30% 12%",
  "--ink-foreground": "0 0% 100%",
  "--primary": "222 65% 40%",
  "--primary-foreground": "0 0% 100%",
  "--primary-soft": "222 60% 95%",
  "--primary-glow": "222 70% 60%",
  "--cta": "222 65% 40%",
  "--cta-foreground": "0 0% 100%",
  "--secondary": "210 30% 95%",
  "--secondary-foreground": "222 30% 20%",
  "--muted": "210 25% 96%",
  "--muted-foreground": "222 15% 45%",
  "--border": "214 25% 90%",
  "--input": "214 25% 90%",
  "--ring": "222 65% 40%",
  "--radius": "0.75rem",
  "--radius-pill": "999px",
  "--font-display": "'Manrope', system-ui, sans-serif",
  "--font-body": "'Inter', system-ui, sans-serif",
};

export const BRANDS: Record<string, Brand> = {
  /**
   * Agencia IDP — colores tomados del sitio en producción (agenciaidp.com):
   * azul #0240BB, naranja #FF661A, tinta #262729, gris de texto #54575D,
   * fondo suave #F6F6F6 y tipografía Plus Jakarta Sans. Los botones de la marca
   * son pastillas naranjas con texto oscuro; eso es lo que replica el token --cta.
   */
  idp: {
    id: "idp",
    name: "Agencia IDP",
    showHeader: true,
    tokens: {
      ...DEFAULT_TOKENS,
      "--background": "0 0% 100%",
      "--foreground": "220 4% 15%",
      "--surface": "0 0% 96%",
      "--ink": "220 4% 15%",
      "--ink-foreground": "0 0% 100%",
      "--primary": "220 98% 37%",
      "--primary-foreground": "0 0% 100%",
      "--primary-soft": "220 92% 95%",
      "--primary-glow": "220 95% 55%",
      "--cta": "20 100% 55%",
      "--cta-foreground": "220 4% 15%",
      "--secondary": "0 0% 96%",
      "--secondary-foreground": "220 4% 15%",
      "--muted": "0 0% 96%",
      "--muted-foreground": "220 5% 40%",
      "--border": "220 13% 90%",
      "--input": "220 13% 90%",
      "--ring": "220 98% 37%",
      "--font-display": "'Plus Jakarta Sans', system-ui, sans-serif",
      "--font-body": "'Plus Jakarta Sans', system-ui, sans-serif",
    },
    copy: {
      ...BASE_COPY,
      contactLabel: "Hablemos",
      contactUrl: "https://agenciaidp.com/contacto/",
      footerNote: "Un servicio de Agencia IDP · Basado en las heurísticas de Jakob Nielsen.",
    },
  },

  /**
   * Plantilla para la segunda agencia. Duplica este bloque, cambia el id, el nombre,
   * los colores y los textos, y apunta el iframe a `?brand=<nuevo-id>`.
   */
  agencia2: {
    id: "agencia2",
    name: "Tu Agencia",
    showHeader: true,
    tokens: {
      ...DEFAULT_TOKENS,
      "--primary": "266 70% 45%",
      "--primary-soft": "266 70% 96%",
      "--primary-glow": "266 75% 62%",
      "--cta": "266 70% 45%",
      "--cta-foreground": "0 0% 100%",
      "--ring": "266 70% 45%",
      "--ink": "266 30% 14%",
    },
    copy: { ...BASE_COPY },
  },
};

export const DEFAULT_BRAND_ID = "idp";

/** Resuelve la marca desde `?brand=`, cayendo a la de por defecto si el id no existe. */
export function resolveBrand(search: string): Brand {
  const requested = new URLSearchParams(search).get("brand");
  if (requested && BRANDS[requested]) return BRANDS[requested];
  return BRANDS[DEFAULT_BRAND_ID];
}
