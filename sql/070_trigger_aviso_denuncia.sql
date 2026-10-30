-- ============================================================================
-- Ruleafit · 070_trigger_aviso_denuncia.sql
-- Al crearse una fila en public.denuncias (sql/068), avisa por correo al
-- administrador: el trigger llama por pg_net a /api/avisar-denuncia, que lee la
-- denuncia y envía el correo con Resend.
--
-- Mismo patrón que sql/052 (aviso de feedback). IMPORTANTE: <CRON_SECRET> es un
-- PLACEHOLDER; al ejecutar este SQL en Supabase hay que sustituirlo por el valor
-- real de la variable CRON_SECRET de producción (el mismo que usa sql/052; NO se
-- versiona en git).
--
-- EJECUTADO a mano en el SQL Editor de Supabase (proyecto "ruleafit") el 30 de
-- octubre de 2026, con el CRON_SECRET real, y probado: al denunciar llega el
-- correo al administrador. Requiere pg_net (ya instalado) y que esté desplegado
-- app/api/avisar-denuncia (si no, los avisos darían 404; la denuncia se guarda
-- igualmente porque pg_net es asíncrono).
-- ============================================================================

create or replace function public.avisar_denuncia_nueva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://www.ruleafit.com/api/avisar-denuncia',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := jsonb_build_object('denunciaId', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_avisar_denuncia on public.denuncias;

create trigger trg_avisar_denuncia
  after insert on public.denuncias
  for each row
  execute function public.avisar_denuncia_nueva();
