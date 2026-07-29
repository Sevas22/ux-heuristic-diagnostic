import { createClient } from "npm:@supabase/supabase-js@2";
import { buildGroqMessages, buildVisualDescriptionMessages, parseGroqReport, type Finding } from "../_shared/groqPrompt.ts";
import { inspectSite, violationsToAccessibilityFindings, type SiteInspection } from "../_shared/siteInspection.ts";
import { pruneUnverifiedFindings, coherentScore, type EvidenceBundle } from "../_shared/reportValidator.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_INTERNAL_PAGES = 2;
const MAX_REFERENCE_SCREENSHOTS = 2;
const MIN_VERIFIED_FINDINGS = 4;
const GROQ_TEXT_MODEL = "llama-3.3-70b-versatile";
// Groq retiró los modelos de visión llama-4-scout/maverick de su catálogo;
// qwen3.6-27b es, al momento de escribir esto, el único modelo con soporte de imágenes disponible.
// Si esto vuelve a fallar con 404 "model_not_found", revisar el catálogo vigente en
// https://api.groq.com/openai/v1/models (buscar "image" en input_modalities).
const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";

async function callGroq(
  messages: unknown[],
  model: string,
  options: { json?: boolean; maxTokens: number },
) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
    },
    body: JSON.stringify({
      model,
      messages,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
      temperature: 0.3,
      max_tokens: options.maxTokens,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq respondió ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices[0].message.content as string;
}

// Llamada liviana (sin json_object, pocos tokens de salida) que solo describe la imagen en texto.
// Así el modelo de texto puede generar el JSON completo del informe sin cargar con el costo de la imagen.
async function describeScreenshot(screenshotUrl: string): Promise<string | null> {
  try {
    return await callGroq(buildVisualDescriptionMessages(screenshotUrl), GROQ_VISION_MODEL, { maxTokens: 500 });
  } catch (err) {
    console.error("describeScreenshot: fallo describiendo la captura", err);
    return null;
  }
}

// Si Groq cita evidencia que no pudimos verificar contra el bundle real, le damos UNA oportunidad
// de corregirse (Groq es gratis, el reintento no cuesta nada) antes de conformarnos con lo verificado.
async function generateVerifiedReport(messages: unknown[], evidenceBundle: EvidenceBundle) {
  let raw = await callGroq(messages, GROQ_TEXT_MODEL, { json: true, maxTokens: 4500 });
  let report = parseGroqReport(raw);
  let pruneResult = pruneUnverifiedFindings(report.findings, evidenceBundle);

  if (pruneResult.kept.length < MIN_VERIFIED_FINDINGS && report.findings.length >= MIN_VERIFIED_FINDINGS) {
    console.warn("generate-report: pocos hallazgos verificables, reintentando", pruneResult.reasons);
    const retryMessages = [
      ...messages,
      { role: "assistant", content: raw },
      {
        role: "user",
        content:
          `Varios hallazgos no se pudieron verificar contra la evidencia real que te di:\n${pruneResult.reasons.join("\n")}\n\n` +
          `Genera de nuevo el JSON completo, esta vez citando en "evidence_ref" y en cualquier texto entre comillas ÚNICAMENTE encabezados, CTAs, o el título/descripción reales que te di. Responde solo con el JSON.`,
      },
    ];
    try {
      const retryRaw = await callGroq(retryMessages, GROQ_TEXT_MODEL, { json: true, maxTokens: 4500 });
      const retryReport = parseGroqReport(retryRaw);
      const retryPrune = pruneUnverifiedFindings(retryReport.findings, evidenceBundle);
      if (retryPrune.kept.length > pruneResult.kept.length) {
        report = retryReport;
        pruneResult = retryPrune;
      }
    } catch (retryErr) {
      console.error("generate-report: el reintento también falló, se sigue con el primer intento", retryErr);
    }
  }

  return { report, pruneResult };
}

async function sendReportEmail(to: string, reportUrl: string, websiteUrl: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM_EMAIL") ?? "diagnostico@resend.dev",
      to,
      subject: "Tu diagnóstico UX/UI está listo",
      html: `<p>Hola,</p><p>Tu diagnóstico UX/UI heurístico para <strong>${websiteUrl}</strong> ya está listo.</p><p><a href="${reportUrl}">Ver el informe</a></p>`,
    }),
  });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const corsHeaders = buildCorsHeaders(req);

  try {
    const { submissionId } = await req.json();
    if (!submissionId) {
      return new Response(JSON.stringify({ error: "submissionId es requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Solo avanza si la submission está en el estado elegible; evita generación duplicada en reintentos del webhook.
    // SKIP_PAYMENT=true (modo actual, sin pasarela de pago) hace elegible 'draft' directamente;
    // en cuanto se reactive Stripe, basta con quitar ese secreto para volver a exigir 'paid'.
    const eligibleStatus = Deno.env.get("SKIP_PAYMENT") === "true" ? "draft" : "paid";
    const { data: submission, error: claimError } = await supabase
      .from("submissions")
      .update({ status: "generating" })
      .eq("id", submissionId)
      .eq("status", eligibleStatus)
      .select("*")
      .maybeSingle();

    if (claimError || !submission) {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      // Inspección real de la home: screenshot, DOM renderizado (headings/CTAs) y axe-core.
      const homeInspection = await inspectSite(submission.website_url);

      const internalLinks = homeInspection.internalLinks.slice(0, MAX_INTERNAL_PAGES);
      const internalInspections = await Promise.all(internalLinks.map((url) => inspectSite(url)));

      const pageCandidates: { url: string; inspection: SiteInspection }[] = [
        { url: submission.website_url, inspection: homeInspection },
        ...internalLinks.map((url, i) => ({ url, inspection: internalInspections[i] })),
      ];
      const pages = pageCandidates
        .filter((p) => Boolean(p.inspection.screenshotUrl))
        .map((p) => ({ url: p.url, screenshot_url: p.inspection.screenshotUrl! }));

      const homepageScreenshot = homeInspection.screenshotUrl;
      if (homepageScreenshot) {
        await supabase.from("submissions").update({ screenshot_url: homepageScreenshot }).eq("id", submission.id);
      }

      const referenceUrls: string[] = (submission.reference_urls ?? []).slice(0, MAX_REFERENCE_SCREENSHOTS);
      const referenceInspections = await Promise.all(referenceUrls.map((url) => inspectSite(url)));
      const referenceScreenshots = referenceUrls
        .map((url, i) => ({ url, screenshot_url: referenceInspections[i].screenshotUrl }))
        .filter((r): r is { url: string; screenshot_url: string } => Boolean(r.screenshot_url));

      // Solo se describe visualmente la primera referencia (costo de tokens de Groq); las demás
      // se muestran igual en el informe para comparación visual, pero sin descripción al modelo.
      const [visualDescription, referenceVisualDescription] = await Promise.all([
        homepageScreenshot ? describeScreenshot(homepageScreenshot) : Promise.resolve(null),
        referenceScreenshots[0] ? describeScreenshot(referenceScreenshots[0].screenshot_url) : Promise.resolve(null),
      ]);

      const messages = buildGroqMessages({
        website_url: submission.website_url,
        page_title: homeInspection.title,
        page_description: homeInspection.metaDescription,
        industry: submission.industry,
        reference_urls: submission.reference_urls ?? [],
        goal: submission.goal,
        pages,
        visual_description: visualDescription,
        reference_visual_description:
          referenceScreenshots[0] && referenceVisualDescription
            ? { url: referenceScreenshots[0].url, description: referenceVisualDescription }
            : null,
        headings: homeInspection.headings,
        ctas: homeInspection.ctas,
      });

      const evidenceBundle: EvidenceBundle = {
        headings: homeInspection.headings,
        ctas: homeInspection.ctas,
        metaTitle: homeInspection.title,
        metaDescription: homeInspection.metaDescription,
        hasScreenshot: Boolean(homepageScreenshot),
        visualDescription,
      };

      const { report, pruneResult } = await generateVerifiedReport(messages, evidenceBundle);

      // Hallazgos de accesibilidad: los construimos nosotros a partir de violaciones reales de
      // axe-core (motor de reglas WCAG corriendo sobre el DOM renderizado), no los genera el modelo
      // — cero riesgo de alucinación. Complementan los hallazgos de UX ya verificados del LLM.
      const accessibilityChecks = violationsToAccessibilityFindings(homeInspection.axeViolations);
      const accessibilityFindings: Finding[] = accessibilityChecks.map((check, i) => ({
        id: `A-${String(i + 1).padStart(2, "0")}`,
        screen: submission.website_url,
        heuristic: "Accesibilidad (WCAG)",
        severity: check.severity,
        impact_score: Math.min(check.severity / 4, 1),
        description: `${check.criterion}: ${check.description}`,
        user_impact: "Puede excluir a usuarios que dependen de lectores de pantalla, navegación por teclado o zoom.",
        recommendation: check.recommendation,
        priority: (check.severity >= 3 ? "Alta" : check.severity === 2 ? "Media" : "Baja") as "Alta" | "Media" | "Baja",
        zone: null,
        evidence_ref: `axe:${check.ruleId}`,
      }));

      const allFindings = [...pruneResult.kept, ...accessibilityFindings];
      const overallScore = coherentScore(allFindings, report.overall_score);

      const transparencyNote = pruneResult.dropped.length > 0
        ? ` Se descartaron ${pruneResult.dropped.length} hallazgo(s) preliminares por no poder verificarse contra la evidencia real del sitio.`
        : "";
      const methodologyWithA11y = {
        ...report.methodology,
        screens_evaluated: pages.map((p) => p.url),
        criteria: accessibilityChecks.length > 0
          ? `${report.methodology.criteria} También se corrieron verificaciones automáticas de accesibilidad (axe-core, motor de reglas WCAG) sobre el DOM renderizado.${transparencyNote}`
          : `${report.methodology.criteria}${transparencyNote}`,
      };

      // El mapa de navegación lo construimos nosotros a partir de los enlaces reales
      // descubiertos (no se lo pedimos al modelo), para que sea 100% fiel al sitio real.
      const pageUrls = new Set(pages.map((p) => p.url));
      const navigationGraph = pages
        .filter((p) => p.url !== submission.website_url)
        .map((p) => ({ from: submission.website_url, to: p.url }));

      // Filtramos cualquier URL que el modelo haya podido inventar en user_flow.
      const userFlow = report.user_flow.filter((url) => pageUrls.has(url));

      await supabase.from("reports").insert({
        submission_id: submission.id,
        overall_score: overallScore,
        executive_summary: report.executive_summary,
        methodology: methodologyWithA11y,
        findings: allFindings,
        navigation_graph: navigationGraph,
        user_flow: userFlow,
        journey_map: report.journey_map,
        conclusions: report.conclusions,
        reference_screenshots: referenceScreenshots,
        lighthouse: homeInspection.lighthouse,
      });

      await supabase.from("submissions").update({ status: "ready" }).eq("id", submission.id);

      const reportUrl = `${Deno.env.get("SITE_URL")}/informe/${submission.access_token}`;
      await sendReportEmail(submission.contact_email, reportUrl, submission.website_url);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (genError) {
      console.error("generate-report: fallo generando el informe", genError);
      await supabase.from("submissions").update({ status: "failed" }).eq("id", submission.id);
      return new Response(JSON.stringify({ error: "Fallo generando el informe" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("generate-report error", err);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
