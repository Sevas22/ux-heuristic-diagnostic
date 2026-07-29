import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SITE_URL = Deno.env.get("SITE_URL")!;

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

    const { data: submission, error: fetchError } = await supabase
      .from("submissions")
      .select("id, access_token, status, contact_email")
      .eq("id", submissionId)
      .single();

    if (fetchError || !submission) {
      return new Response(JSON.stringify({ error: "Submission no encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (submission.status !== "draft") {
      return new Response(JSON.stringify({ error: "Esta submission ya fue pagada o procesada" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceId = Deno.env.get("STRIPE_PRICE_ID");
    const lineItems = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            quantity: 1,
            price_data: {
              currency: Deno.env.get("STRIPE_CURRENCY") ?? "usd",
              product_data: { name: "Diagnóstico UX/UI Heurístico" },
              unit_amount: Number(Deno.env.get("UX_REPORT_PRICE_CENTS") ?? "2900"),
            },
          },
        ];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: submission.contact_email,
      success_url: `${SITE_URL}/informe/${submission.access_token}?checkout=success`,
      cancel_url: `${SITE_URL}/formulario?checkout=cancelled`,
      metadata: { submission_id: submission.id },
    });

    await supabase
      .from("submissions")
      .update({ stripe_session_id: session.id })
      .eq("id", submission.id);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout-session error", err);
    return new Response(JSON.stringify({ error: "Error creando la sesión de pago" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
