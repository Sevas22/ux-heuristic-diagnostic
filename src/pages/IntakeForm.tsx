import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

// La industria orienta el análisis del agente (qué patrones y expectativas son propios del sector),
// así que conviene que el usuario encuentre la suya en vez de caer siempre en "Otra".
const INDUSTRIES = [
  "E-commerce / Retail",
  "Marketplace",
  "SaaS / Software",
  "Fintech / Servicios financieros",
  "Seguros",
  "Criptomonedas / Web3",
  "Salud / Bienestar",
  "Educación / EdTech",
  "Medios / Contenido",
  "Entretenimiento / Streaming",
  "Videojuegos",
  "Servicios profesionales",
  "Agencia / Marketing",
  "Legal",
  "Recursos humanos / Empleo",
  "Inmobiliaria / PropTech",
  "Construcción / Arquitectura",
  "Turismo / Hotelería",
  "Restaurantes / Delivery",
  "Moda / Belleza",
  "Deportes / Fitness",
  "Automotriz / Movilidad",
  "Logística / Transporte",
  "Manufactura / Industrial",
  "Agro / Alimentación",
  "Energía / Servicios públicos",
  "Telecomunicaciones",
  "ONG / Fundaciones",
  "Gobierno / Sector público",
  "Otra",
];

const MAX_REFERENCE_URLS = 5;

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function parseReferenceUrls(raw: string | undefined): string[] {
  if (!raw) return [];

  const candidates = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const normalized = candidates.map(normalizeUrl).filter(isValidUrl);

  return Array.from(new Set(normalized)).slice(0, MAX_REFERENCE_URLS);
}

const formSchema = z.object({
  contactName: z.string().min(2, "Ingresa tu nombre completo"),
  contactEmail: z.string().email("Ingresa un email válido"),
  websiteUrl: z
    .string()
    .min(3, "Ingresa tu dominio, ej: tuempresa.com")
    .transform(normalizeUrl)
    .refine(isValidUrl, "Ingresa un dominio válido, ej: tuempresa.com"),
  industry: z.string().min(1, "Selecciona el tipo de industria"),
  goal: z.string().min(10, "Cuéntanos un poco más qué te gustaría lograr"),
  referenceUrls: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function IntakeForm() {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contactName: "",
      contactEmail: "",
      websiteUrl: "",
      industry: "",
      goal: "",
      referenceUrls: "",
    },
  });

  async function onSubmit(values: FormValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const { data: created, error: rpcError } = await supabase.rpc("create_submission", {
        p_contact_name: values.contactName,
        p_contact_email: values.contactEmail,
        p_website_url: values.websiteUrl,
        p_industry: values.industry,
        p_reference_urls: parseReferenceUrls(values.referenceUrls),
        p_goal: values.goal,
      });

      if (rpcError || !created?.[0]) {
        throw rpcError ?? new Error("No se pudo crear la solicitud");
      }

      const { id: submissionId, access_token: accessToken } = created[0];

      // Sin pasarela de pago por ahora: generamos el informe directo tras crear la submission.
      const { error: genError } = await supabase.functions.invoke("generate-report", {
        body: { submissionId },
      });

      if (genError) {
        // El backend distingue la congestión momentánea (429) del fallo real. Decirle "algo salió
        // mal" a alguien que solo llegó en mal momento lo hace abandonar, cuando bastaba esperar.
        const status = (genError as { context?: { status?: number } }).context?.status;
        if (status === 429) {
          toast.error("Hay muchas solicitudes en curso. Espera un minuto y vuelve a intentarlo.");
          submittingRef.current = false;
          setSubmitting(false);
          return;
        }
        throw genError;
      }

      window.location.href = `/informe/${accessToken}`;
    } catch (err) {
      console.error(err);
      toast.error("Algo salió mal. Intenta de nuevo en unos minutos.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface py-12">
      <div className="container mx-auto max-w-xl">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Solicita tu diagnóstico UX/UI</CardTitle>
          <CardDescription>
            Cuéntanos un poco de contexto: nuestro agente de IA visita tu sitio, lo analiza y lo compara contra lo
            que quieres lograr.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="websiteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dominio o URL de tu sitio</FormLabel>
                    <FormControl>
                      <Input placeholder="tuempresa.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ana Torres" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="ana@empresa.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de industria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una opción" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INDUSTRIES.map((industry) => (
                          <SelectItem key={industry} value={industry}>
                            {industry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>¿Qué te gustaría lograr con este diagnóstico?</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Ej: quiero aumentar las conversiones en mi checkout" {...field} />
                    </FormControl>
                    <FormDescription>Esto orienta las recomendaciones hacia lo que realmente buscas.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="referenceUrls"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sitios que te gustan como referencia (opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="stripe.com, linear.app" {...field} />
                    </FormControl>
                    <FormDescription>Sepáralos con comas. El agente los usa para entender el estilo que buscas.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" variant="cta" size="lg" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? "Auditando tu sitio a fondo... puede tardar 1-3 minutos" : "Generar mi diagnóstico"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
