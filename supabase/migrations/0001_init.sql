create extension if not exists pgcrypto;

create type submission_status as enum ('draft', 'paid', 'generating', 'ready', 'failed');

create table submissions (
  id uuid primary key default gen_random_uuid(),
  access_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contact_name text not null,
  contact_email text not null,
  website_url text not null,
  extra_context text,
  screenshot_url text,
  status submission_status not null default 'draft',
  stripe_session_id text
);

create index submissions_access_token_idx on submissions (access_token);
create index submissions_stripe_session_id_idx on submissions (stripe_session_id);

create table reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  overall_score numeric,
  heuristics jsonb not null,
  summary text,
  pdf_url text,
  created_at timestamptz not null default now()
);

create index reports_submission_id_idx on reports (submission_id);

alter table submissions enable row level security;
alter table reports enable row level security;
-- No hay policies de select/insert/update para anon/authenticated a propósito:
-- el acceso público pasa únicamente por las funciones RPC de abajo (security definer),
-- y las Edge Functions usan la service_role key, que ignora RLS.

create or replace function public.create_submission(
  p_contact_name text,
  p_contact_email text,
  p_website_url text,
  p_extra_context text
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
  insert into submissions (contact_name, contact_email, website_url, extra_context)
  values (p_contact_name, p_contact_email, p_website_url, p_extra_context)
  returning submissions.id, submissions.access_token into v_id, v_token;

  return query select v_id, v_token;
end;
$$;

revoke all on function public.create_submission(text, text, text, text) from public;
grant execute on function public.create_submission(text, text, text, text) to anon, authenticated;

create or replace function public.get_report_by_token(p_token uuid)
returns table (
  status submission_status,
  website_url text,
  screenshot_url text,
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
  select s.status, s.website_url, s.screenshot_url,
         r.overall_score, r.heuristics, r.summary, r.pdf_url, r.created_at
  from submissions s
  left join reports r on r.submission_id = s.id
  where s.access_token = p_token;
$$;

revoke all on function public.get_report_by_token(uuid) from public;
grant execute on function public.get_report_by_token(uuid) to anon, authenticated;
