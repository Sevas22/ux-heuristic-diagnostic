alter table reports
  drop column if exists first_impression,
  drop column if exists summary,
  drop column if exists heuristics,
  drop column if exists priority_actions;

alter table reports
  add column executive_summary jsonb,
  add column methodology jsonb,
  add column findings jsonb,
  add column navigation_graph jsonb,
  add column user_flow jsonb,
  add column journey_map jsonb,
  add column conclusions jsonb;

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
  pdf_url text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select s.status, s.website_url, s.screenshot_url, s.industry, s.reference_urls, s.goal,
         r.overall_score, r.executive_summary, r.methodology, r.findings, r.navigation_graph,
         r.user_flow, r.journey_map, r.conclusions, r.pdf_url, r.created_at
  from submissions s
  left join reports r on r.submission_id = s.id
  where s.access_token = p_token;
$$;

revoke all on function public.get_report_by_token(uuid) from public;
grant execute on function public.get_report_by_token(uuid) to anon, authenticated;
