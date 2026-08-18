import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/lib/brand";
import {
  ArrowRight,
  Check,
  FileText,
  Gauge,
  Accessibility,
  Target,
  Map as MapIcon,
  ScanSearch,
} from "lucide-react";

/** Las 10 heurísticas de Nielsen: contenido del producto, igual para toda marca. */
const HEURISTICS = [
  "Visibilidad del estado del sistema",
  "Relación entre el sistema y el mundo real",
  "Control y libertad del usuario",
  "Consistencia y estándares",
  "Prevención de errores",
  "Reconocer antes que recordar",
  "Flexibilidad y eficiencia de uso",
  "Diseño estético y minimalista",
  "Recuperación ante errores",
  "Ayuda y documentación",
];

/** Iconos para la grilla de entregables, emparejados por posición con brand.copy.deliverables. */
const DELIVERABLE_ICONS = [FileText, ScanSearch, Gauge, Accessibility, Target, MapIcon];

/** Anillo de puntaje del informe de muestra que se ve en el hero. */
function ScoreRing({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-extrabold leading-none text-foreground">
          {score}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

/**
 * Vista previa del informe. Es una muestra ilustrativa, no datos de un cliente: sirve para
 * que se entienda qué se recibe antes de pedirle el dominio a nadie.
 */
function ReportPreview() {
  const metrics = [
    { label: "Rendimiento", value: 64 },
    { label: "Accesibilidad", value: 81 },
    { label: "SEO", value: 92 },
  ];
  const findings = [
    { severity: "Crítico", text: "El CTA principal no se distingue del fondo", tone: "destructive" },
    { severity: "Alto", text: "Formulario sin mensajes de error claros", tone: "warning" },
    { severity: "Medio", text: "Jerarquía tipográfica inconsistente", tone: "primary" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-5 flex items-center gap-5">
        <ScoreRing score={72} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Informe de muestra
          </p>
          <p className="font-display text-lg font-extrabold text-foreground">UX Score general</p>
          <p className="text-sm text-muted-foreground">12 hallazgos · 3 críticos</p>
        </div>
      </div>

      <div className="mb-5 space-y-2.5">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs font-medium text-foreground">{m.label}</span>
              <span className="text-xs font-bold tabular-nums text-muted-foreground">{m.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${m.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <ul className="space-y-2 border-t border-border pt-4">
        {findings.map((f) => (
          <li key={f.text} className="flex items-start gap-2.5">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: `hsl(var(--${f.tone}))` }}
            />
            <span className="text-xs leading-snug text-muted-foreground">
              <span className="font-semibold text-foreground">{f.severity}:</span> {f.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Landing() {
  const brand = useBrand();
  const { copy } = brand;

  return (
    <div className="min-h-screen bg-background">
      {brand.showHeader && (
        <header className="border-b border-border bg-background">
          <div className="container mx-auto flex items-center justify-between gap-4 py-4">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto" />
            ) : (
              <span className="font-display text-lg font-extrabold text-foreground">
                {brand.name}
              </span>
            )}
            <Button asChild variant="cta" size="sm">
              <Link to="/formulario">{copy.ctaPrimary}</Link>
            </Button>
          </div>
        </header>
      )}

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Halo suave detrás del hero: da profundidad sin competir con el contenido. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[420px] opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 50%, hsl(var(--primary-soft)) 0%, transparent 70%)",
          }}
        />
        <div className="container relative mx-auto grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-primary-soft px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              {copy.eyebrow}
            </span>

            <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-[3.4rem]">
              {copy.title}{" "}
              <span className="relative inline-block">
                <span className="relative z-10">{copy.titleHighlight}</span>
                {/* Subrayado de marca: refuerza el color de acción sin gritarlo. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-1 z-0 h-3 rounded-sm bg-cta/35"
                />
              </span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              {copy.subtitle}
            </p>

            <Button asChild variant="cta" size="xl">
              <Link to="/formulario">
                {copy.ctaPrimary}
                <ArrowRight className="ml-1" />
              </Link>
            </Button>

            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {copy.reassurances.map((r) => (
                <li key={r} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:pl-4">
            <ReportPreview />
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="bg-surface py-16 md:py-20">
        <div className="container mx-auto">
          <h2 className="mb-10 text-center font-display text-3xl font-extrabold text-foreground md:text-4xl">
            {copy.stepsTitle}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {copy.steps.map((step, i) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-border bg-card p-7 shadow-card"
              >
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] bg-cta font-display text-lg font-extrabold text-cta-foreground">
                  {i + 1}
                </span>
                <h3 className="mb-2 font-display text-lg font-extrabold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUÉ RECIBES */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto">
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">
              {copy.deliverablesTitle}
            </h2>
            <p className="mt-3 text-muted-foreground">{copy.deliverablesSubtitle}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {copy.deliverables.map((d, i) => {
              const Icon = DELIVERABLE_ICONS[i % DELIVERABLE_ICONS.length];
              return (
                <div
                  key={d.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-soft"
                >
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mb-1.5 font-display text-base font-extrabold text-foreground">
                    {d.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{d.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HEURÍSTICAS */}
      <section className="bg-surface py-16 md:py-20">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">
            {copy.heuristicsTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{copy.heuristicsSubtitle}</p>
          <ul className="mt-9 flex flex-wrap justify-center gap-2.5">
            {HEURISTICS.map((h, i) => (
              <li
                key={h}
                className="flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-4 py-2 text-sm text-foreground shadow-card"
              >
                <span className="font-display text-xs font-extrabold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CIERRE */}
      <section className="bg-ink py-16 md:py-20">
        <div className="container mx-auto flex flex-col items-center gap-6 text-center">
          <h2 className="max-w-2xl font-display text-3xl font-extrabold text-ink-foreground md:text-4xl">
            {copy.closingTitle}
          </h2>
          <p className="max-w-xl text-ink-foreground/70">{copy.closingSubtitle}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="cta" size="xl">
              <Link to="/formulario">
                {copy.ctaPrimary}
                <ArrowRight className="ml-1" />
              </Link>
            </Button>
            {copy.contactUrl && copy.contactLabel && (
              <Button
                asChild
                variant="ctaOutline"
                size="xl"
                className="border-ink-foreground/40 text-ink-foreground hover:bg-ink-foreground hover:text-ink hover:border-ink-foreground"
              >
                <a href={copy.contactUrl} target="_blank" rel="noreferrer">
                  {copy.contactLabel}
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background py-8">
        <div className="container mx-auto flex flex-col items-center gap-1 text-center">
          <span className="font-display text-sm font-extrabold text-foreground">{brand.name}</span>
          <p className="text-xs text-muted-foreground">{copy.footerNote}</p>
        </div>
      </footer>
    </div>
  );
}
