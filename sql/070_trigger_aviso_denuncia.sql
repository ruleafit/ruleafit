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
-- NO EJECUTADO todavía. Preparado para revisión y ejecución manual en el SQL
-- Editor de Supabase (proyecto "ruleafit"). Requiere pg_net (ya instalado).
-- Hay que ejecutarlo DESPUÉS de desplegar app/api/avisar-denuncia, o los
-- primeros avisos darán 404 (la denuncia se guarda igualmente: pg_net es
-- asíncrono y un fallo no la deshace).
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
