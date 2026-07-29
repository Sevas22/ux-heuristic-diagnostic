// Orígenes permitidos: el sitio en producción (SITE_URL) más los puertos de desarrollo local.
// Antes se devolvía SITE_URL fijo como Access-Control-Allow-Origin, lo que rompía el desarrollo
// local en cuanto SITE_URL apuntaba a producción (el navegador bloqueaba la respuesta).
function allowedOrigins(): string[] {
  const siteUrl = Deno.env.get("SITE_URL");
  return [
    siteUrl,
    "http://localhost:8081",
    "http://localhost:5173",
  ].filter((o): o is string => Boolean(o));
}

// El header Access-Control-Allow-Origin no admite una lista: hay que devolver el origen concreto
// de esta petición (si está permitido), por eso se calcula por request en vez de ser una constante.
export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = allowedOrigins();
  const allowOrigin = allowed.includes(origin) ? origin : (allowed[0] ?? "*");

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // El origen permitido varía según quién pregunta, así que las cachés no deben reutilizar
    // la respuesta de un origen para otro.
    Vary: "Origin",
  };
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }
  return null;
}
