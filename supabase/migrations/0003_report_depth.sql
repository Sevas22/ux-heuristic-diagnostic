alter table reports
  add column first_impression text,
  add column priority_actions jsonb;

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
  first_impression text,
  heuristics jsonb,
  priority_actions jsonb,
  summary text,
  pdf_url text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select s.status, s.website_url, s.screenshot_url, s.industry, s.reference_urls, s.goal,
         r.overall_score, r.first_impression, r.heuristics, r.priority_actions, r.summary, r.pdf_url, r.created_at
  from submissions s
  left join reports r on r.submission_id = s.id
  where s.access_token = p_token;
$$;

revoke all on function public.get_report_by_token(uuid) from public;
grant execute on function public.get_report_by_token(uuid) to anon, authenticated;
