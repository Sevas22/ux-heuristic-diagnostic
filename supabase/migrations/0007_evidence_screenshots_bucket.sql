-- Bucket público donde evidence-service (Vercel) sube los screenshots que captura con Playwright.
-- public = true: los objetos se sirven por URL pública sin necesitar policies de RLS para lectura.
insert into storage.buckets (id, name, public)
values ('evidence-screenshots', 'evidence-screenshots', true)
on conflict (id) do nothing;
