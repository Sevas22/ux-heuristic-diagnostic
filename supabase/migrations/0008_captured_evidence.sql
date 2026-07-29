-- La evidencia cruda que evidence-service captura del sitio (encabezados y CTAs reales, y el
-- detalle completo de las violaciones de axe-core con impacto y nº de elementos afectados) hasta
-- ahora solo se le pasaba al modelo y se descartaba. Guardarla permite mostrarla en el informe:
-- es la parte más verificable y concreta del análisis, y la que demuestra que se visitó el sitio.
alter table reports
  add column captured_evidence jsonb;

drop function if exists public.get_report_by_token(uuid);

create or replace function public.get_report_by_token(p_token uuid)
returns table (
  status submission_status,
  website_url text,
  screenshot_url text,
  industry text,
  reference_urls text[],
  goal text,
  overall_score numeric,
  executive_summary jsonb,
  methodology jsonb,
  findings jsonb,
  navigation_graph jsonb,
  user_flow jsonb,
  journey_map jsonb,
  conclusions jsonb,
  reference_screenshots jsonb,
  lighthouse jsonb,
  captured_evidence jsonb,
  pdf_url text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select s.status, s.website_url, s.screenshot_url, s.industry, s.reference_urls, s.goal,
         r.overall_score, r.executive_summary, r.methodology, r.findings, r.navigation_graph,
         r.user_flow, r.journey_map, r.conclusions, r.reference_screenshots, r.lighthouse,
         r.captured_evidence, r.pdf_url, r.created_at
  from submissions s
  left join reports r on r.submission_id = s.id
  where s.access_token = p_token;
$$;

revoke all on function public.get_report_by_token(uuid) from public;
grant execute on function public.get_report_by_token(uuid) to anon, authenticated;
