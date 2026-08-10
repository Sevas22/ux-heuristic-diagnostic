import { createClient } from "npm:@supabase/supabase-js@2";
import { buildGroqMessages, buildVisualDescriptionMessages, parseGroqReport, type Finding } from "../_shared/groqPrompt.ts";
import {
  inspectSite,
  fetchLighthouse,
  violationsToAccessibilityFindings,
  type SiteInspection,
} from "../_shared/siteInspection.ts";
import { pruneUnverifiedFindings, coherentScore, type EvidenceBundle } from "../_shared/reportValidator.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Cada inspección lanza un Chromium propio en Vercel y un sitio pesado tarda ~40s. La función de
// Supabase corta a los 150s (WORKER_RESOURCE_LIMIT), así que el presupuesto es ajustado: se analiza
// una página interna y una referencia, no dos, y lo opcional se descarta si vamos tarde.
const MAX_INTERNAL_PAGES = 1;
const MAX_REFERENCE_SCREENSHOTS = 1;
// Si la inspección inicial ya tardó esto, el sitio es lento y una segunda página costaría otro
// tanto: sumado a las llamadas al modelo se pasa de los 150s y la función muere sin informe.
// El umbral es bajo a propósito — un sitio ágil (~10-15s) sigue analizando su página interna,
// uno pesado se queda solo con la home, que es suficiente para sostener el informe.
const INTERNAL_PAGE_DEADLINE_MS = 25000;
const MIN_VERIFIED_FINDINGS = 4;
// llama-3.3-70b no seguía las instrucciones de profundidad: devolvía causas raíz que repetían el
// síntoma ("la causa es la falta de jerarquía" para un problema de jerarquía) y recomendaciones
// genéricas, incluso con ejemplos explícitos en el prompt. gpt-oss-120b sí produce el análisis a
// nivel consultoría. Es un modelo de razonamiento: consume tokens extra pensando, y el límite del
// plan gratuito de Groq es 8000 por minuto, de ahí reasoning_effort bajo y el tope de salida.
const GROQ_TEXT_MODEL = "openai/gpt-oss-120b";
// El prompt ronda los 4300 tokens (sistema + evidencia real del sitio) y el techo de Groq gratis
// es 8000 por minuto contando entrada y salida, así que este es el margen real disponible.
const GROQ_TEXT_MAX_TOKENS = 3500;
// Groq retiró los modelos de visión llama-4-scout/maverick de su catálogo;
// qwen3.6-27b es, al momento de escribir esto, el único modelo con soporte de imágenes disponible.
// Si esto vuelve a fallar con 404 "model_not_found", revisar el catálogo vigente en
// https://api.groq.com/openai/v1/models (buscar "image" en input_modalities).
const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";

async function callGroq(
  messages: unknown[],
  model: string,
  options: { json?: boolean; maxTokens: number; reasoningEffort?: "low" | "medium" | "high" },
  retryOnRateLimit = true,
): Promise<string> {
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
      ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
      temperature: 0.3,
      max_tokens: options.maxTokens,
    }),
  });

  if (!res.ok) {
    const body = await res.text();

    // El plan gratuito de Groq permite 8000 tokens por minuto: dos informes generados con poco
    // margen entre sí agotan la ventana y el segundo falla. Groq indica cuántos segundos faltan
    // para que se libere, así que se espera ese tiempo y se reintenta una vez en lugar de perder
    // el informe entero (que para el usuario ya significó minutos de espera).
    if (res.status === 429 && retryOnRateLimit) {
      const waitSeconds = Number(body.match(/try again in ([\d.]+)s/i)?.[1] ?? 0);
      const waitMs = Math.min(Math.ceil((waitSeconds + 1) * 1000), 65000);
      console.warn(`callGroq: límite de tasa alcanzado, reintentando en ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return callGroq(messages, model, options, false);
    }

    throw new Error(`Groq respondió ${res.status}: ${body}`);
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
  let raw = await callGroq(messages, GROQ_TEXT_MODEL, { json: true, maxTokens: GROQ_TEXT_MAX_TOKENS, reasoningEffort: "low" });
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
      const retryRaw = await callGroq(retryMessages, GROQ_TEXT_MODEL, { json: true, maxTokens: GROQ_TEXT_MAX_TOKENS, reasoningEffort: "low" });
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
      const startedAt = Date.now();
      const referenceUrlsToInspect: string[] = (submission.reference_urls ?? []).slice(0, MAX_REFERENCE_SCREENSHOTS);

      // Todo lo que no dependa de otra cosa arranca a la vez. Inspeccionar un sitio pesado puede
      // tardar ~40s: encadenar home -> internas -> referencias sumaba más de dos minutos y la
      // función se quedaba sin tiempo, dejando la solicitud colgada en "generating" para siempre.
      // Las referencias no dependen de la home, así que no hay motivo para esperarlas en fila.
      const [homeInspection, lighthouse, referenceInspections] = await Promise.all([
        inspectSite(submission.website_url),
        fetchLighthouse(submission.website_url),
        Promise.all(referenceUrlsToInspect.map((url) => inspectSite(url))),
      ]);

      // Las páginas internas sí dependen de la home: sus enlaces se descubren al inspeccionarla.
      // Son lo primero que se sacrifica si el sitio resultó lento, porque el informe se sostiene
      // perfectamente con la home y perder la función entera no se sostiene de ninguna manera.
      const elapsed = Date.now() - startedAt;
      const internalLinks =
        elapsed < INTERNAL_PAGE_DEADLINE_MS ? homeInspection.internalLinks.slice(0, MAX_INTERNAL_PAGES) : [];
      if (elapsed >= INTERNAL_PAGE_DEADLINE_MS) {
        console.warn(`generate-report: ${elapsed}ms en la inspección inicial, se omiten las páginas internas`);
      }
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

      const referenceScreenshots = referenceUrlsToInspect
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
        // El título del catálogo describe el problema en términos de producto ("Contraste
        // insuficiente entre texto y fondo"), mucho más útil que repetir "Accesibilidad (WCAG)"
        // en los seis hallazgos. La categoría se conserva entre paréntesis para poder agruparlos.
        heuristic: `${check.criterion} (WCAG)`,
        severity: check.severity,
        impact_score: Math.min(check.severity / 4, 1),
        description: check.description,
        root_cause: check.rootCause,
        user_impact: check.userImpact,
        business_impact:
          check.severity >= 3
            ? "Excluye a parte de los visitantes de completar la acción principal del sitio, y la accesibilidad web es exigible por normativa en la mayoría de mercados."
            : "Degrada la experiencia de quienes usan tecnologías de asistencia y suma deuda de accesibilidad que encarece cualquier auditoría formal posterior.",
        recommendation: check.recommendation,
        priority: (check.severity >= 3 ? "Alta" : check.severity === 2 ? "Media" : "Baja") as "Alta" | "Media" | "Baja",
        // axe cuenta exactamente cuántos nodos del DOM incumplen cada regla, así que la frecuencia
        // acá no es una estimación: sale del dato medido.
        frequency: (check.nodeCount > 10 ? "Sistémico" : check.nodeCount > 2 ? "Recurrente" : "Aislado") as
          | "Sistémico"
          | "Recurrente"
          | "Aislado",
        effort: (check.severity >= 3 ? "Medio" : "Bajo") as "Medio" | "Bajo",
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
        lighthouse,
        // Evidencia cruda capturada del sitio: es la parte más concreta y verificable del informe
        // (antes solo alimentaba al modelo y se descartaba, así que el cliente nunca la veía).
        captured_evidence: {
          headings: homeInspection.headings,
          ctas: homeInspection.ctas,
          axe_violations: homeInspection.axeViolations,
          page_title: homeInspection.title,
          meta_description: homeInspection.metaDescription,
        },
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

      // El plan gratuito de Groq permite ~1 informe por minuto: si dos personas solicitan a la vez,
      // la segunda choca con el límite. Eso NO es un fallo del informe, es congestión momentánea.
      // Marcarlo como "failed" dejaba la solicitud muerta y obligaba al usuario a empezar de cero,
      // así que se devuelve al estado elegible para que el reintento funcione sobre la misma.
      const message = String(genError);
      const isTransient = message.includes("429") || message.toLowerCase().includes("rate limit");

      await supabase
        .from("submissions")
        .update({ status: isTransient ? eligibleStatus : "failed" })
        .eq("id", submission.id);

      return new Response(
        JSON.stringify({
          error: isTransient ? "Servicio saturado, reintentá en un minuto" : "Fallo generando el informe",
          code: isTransient ? "busy" : "failed",
        }),
        {
          status: isTransient ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (err) {
    console.error("generate-report error", err);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
