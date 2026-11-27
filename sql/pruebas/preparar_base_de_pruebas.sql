-- ============================================================================
-- Ruleafit · preparar_base_de_pruebas.sql
-- ⛔ SOLO PARA EL PROYECTO SUPABASE DE PRUEBAS. ACTIVA LOS PAGOS. NUNCA EN PRODUCCIÓN.
--
-- Se ejecuta DESPUÉS de cargar en el proyecto de pruebas el esquema public de producción y las migraciones
-- 096, 098, 099 y 100. Añade lo que un volcado del esquema public no trae (triggers de auth, clave del IBAN,
-- permisos de fotos) y activa los pagos de ESA base. Se detiene solo si la base parece la de producción.
-- ============================================================================
do $$
begin
  if to_regclass('cron.job') is not null
     and exists (select 1 from cron.job where command like '%ruleafit.com%') then
    raise exception 'ALTO: esta base tiene crons que llaman a ruleafit.com. Es PRODUCCIÓN: no se cambia nada.';
  end if;
  if (select count(*) from auth.users) > 10 then
    raise exception 'ALTO: esta base tiene más de 10 cuentas. No parece de pruebas: no se cambia nada.';
  end if;

  drop trigger if exists on_auth_user_created_crear_perfil on auth.users;
  create trigger on_auth_user_created_crear_perfil
    after insert on auth.users for each row execute function public.crear_perfil_para_usuario_nuevo();

  drop trigger if exists on_auth_user_created_otorgar_bienvenida on auth.users;
  create trigger on_auth_user_created_otorgar_bienvenida
    after insert on auth.users for each row execute function public.otorgar_rulos_bienvenida();

  drop trigger if exists on_auth_user_invitacion on auth.users;
  create trigger on_auth_user_invitacion
    after insert or update of email_confirmed_at on auth.users
    for each row execute function public.procesar_invitacion_alta();

  if not exists (select 1 from vault.secrets where name = 'iban_clave') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'iban_clave', 'Clave de PRUEBAS para IBAN');
  end if;

  insert into public.config_pagos (id) values (true) on conflict (id) do nothing;
  update public.config_pagos set pagos_activos = true where id;
end;
$$;

-- Comprobación: pagos_activos = true (solo en pruebas), frenos en false y 3 triggers.
select pagos_activos, parada_cobros, parada_devoluciones from public.config_pagos;
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and tgname like 'on_auth_user%' order by 1;
