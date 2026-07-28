alter table submissions
  add column industry text,
  add column reference_urls text[] not null default '{}',
  add column goal text;

alter table submissions drop column if exists extra_context;

drop function if exists public.create_submission(text, text, text, text);

create or replace function public.create_submission(
  p_contact_name text,
  p_contact_email text,
  p_website_url text,
  p_industry text,
  p_reference_urls text[],
  p_goal text
)
returns table (id uuid, access_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token uuid;
begin
  insert into submissions (contact_name, contact_email, website_url, industry, reference_urls, goal)
  values (p_contact_name, p_contact_email, p_website_url, p_industry, coalesce(p_reference_urls, '{}'), p_goal)
  returning submissions.id, submissions.access_token into v_id, v_token;

  return query select v_id, v_token;
end;
$$;

revoke all on function public.create_submission(text, text, text, text, text[], text) from public;
grant execute on function public.create_submission(text, text, text, text, text[], text) to anon, authenticated;

-- create or replace no permite cambiar el shape de retorno de una función existente.
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
  heuristics jsonb,
  summary text,
  pdf_url text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select s.status, s.website_url, s.screenshot_url, s.industry, s.reference_urls, s.goal,
         r.overall_score, r.heuristics, r.summary, r.pdf_url, r.created_at
  from submissions s
  left join reports r on r.submission_id = s.id
  where s.access_token = p_token;
$$;

revoke all on function public.get_report_by_token(uuid) from public;
grant execute on function public.get_report_by_token(uuid) to anon, authenticated;
