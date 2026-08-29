-- ============================================================================
-- Ruleafit · 052_trigger_aviso_feedback.sql
-- Al insertarse una fila nueva en public.feedback, dispara por pg_net una
-- llamada HTTP POST a /api/avisar-feedback (backend en Vercel), que lee el
-- feedback por su id y envia un correo de aviso al administrador via Resend.
--
-- Mismo patron que sql/040 (cron que llama a /api/procesar-notificaciones):
-- el CRON_SECRET se pasa como Bearer token y NUNCA se versiona en git ni se
-- expone al cliente. Aqui, en vez de un cron periodico, el propio INSERT en
-- feedback dispara la llamada de forma inmediata, via un trigger AFTER INSERT.
--
-- IMPORTANTE: el token de abajo es un PLACEHOLDER. Al ejecutar este SQL en
-- Supabase, sustituir <CRON_SECRET> por el valor real de la variable
-- CRON_SECRET (que NO se versiona en git). El valor real vive en .env.local
-- y en las variables de entorno de Vercel.
--
-- Requiere la extension pg_net instalada (ya lo esta, ver sql/040).
--
-- Idempotente: CREATE OR REPLACE FUNCTION y DROP TRIGGER IF EXISTS antes de
-- crear el trigger, para poder reejecutar el archivo sin error.
--
-- NO EJECUTADO todavia. Preparado para revision antes de aplicarlo
-- manualmente en el editor SQL de Supabase (proyecto "openfit").
-- ============================================================================

create or replace function public.avisar_feedback_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://www.ruleafit.com/api/avisar-feedback',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := jsonb_build_object('feedbackId', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_avisar_feedback on public.feedback;

create trigger trg_avisar_feedback
  after insert on public.feedback
  for each row
  execute function public.avisar_feedback_nuevo();
