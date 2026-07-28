import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Globe, Zap } from "lucide-react";

const STEPS = [
  {
    icon: Globe,
    title: "Cuéntanos tu contexto",
    description: "Tu dominio, industria, sitios de referencia que te gustan y qué te gustaría lograr.",
  },
  {
    icon: Zap,
    title: "El agente analiza tu sitio",
    description: "Captura tu página automáticamente y la evalúa con las 10 heurísticas de Nielsen.",
  },
  {
    icon: Sparkles,
    title: "Recibe tu diagnóstico",
    description: "En menos de un minuto ves el informe completo, con hallazgos y recomendaciones accionables.",
  },
];

const HEURISTICS_PREVIEW = [
  "Visibilidad del estado del sistema",
  "Consistencia y estándares",
  "Prevención de errores",
  "Diseño estético y minimalista",
  "Ayuda y documentación",
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between py-4">
          <span className="font-display text-lg font-extrabold text-primary">UX Heurístico</span>
          <Button asChild size="sm">
            <Link to="/formulario">Solicitar diagnóstico</Link>
          </Button>
        </div>
      </header>

      <section className="container mx-auto flex flex-col items-center gap-6 py-20 text-center">
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3.5 w-3.5" /> Generado con IA
        </Badge>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
          Diagnóstico UX/UI heurístico para tu producto digital, en minutos
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Cuéntale al agente tu dominio, tu industria, qué sitios te gustan y qué quieres lograr. Con ese
          contexto, evalúa tu producto contra las 10 heurísticas de usabilidad de Nielsen y te entrega
          recomendaciones concretas y alineadas a lo que buscas.
        </p>
        <div className="flex gap-3">
          <Button asChild size="lg">
            <Link to="/formulario">Empezar mi diagnóstico</Link>
          </Button>
        </div>
      </section>

      <section className="container mx-auto grid gap-6 py-12 md:grid-cols-3">
        {STEPS.map((step) => (
          <Card key={step.title} className="shadow-card">
            <CardHeader>
              <step.icon className="h-8 w-8 text-primary" />
              <CardTitle className="pt-2 text-lg">{step.title}</CardTitle>
              <CardDescription>{step.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="container mx-auto py-12">
        <Card className="mx-auto max-w-2xl shadow-card">
          <CardHeader>
            <CardTitle>Qué incluye el informe</CardTitle>
            <CardDescription>Cobertura completa de las 10 heurísticas de Nielsen, entre ellas:</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {HEURISTICS_PREVIEW.map((h) => (
                <li key={h} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  {h}
                </li>
              ))}
              <li className="flex items-center gap-2 text-sm text-muted-foreground">y 5 heurísticas más...</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} UX Heurístico
      </footer>
    </div>
  );
}
