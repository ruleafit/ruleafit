-- Reversión de 099. Antes: dar de baja el cron (099_alertas_operativas_cron_baja.sql) y desplegar sin estas rutas.
drop trigger if exists trg_bloquear_cobros_en_parada on public.cobros;
drop function if exists public.bloquear_cobros_en_parada();
drop function if exists public.revisar_salud_pagos();
drop function if exists public.alerta_segun(boolean, text, text, text, text, text);
drop function if exists public.marcar_alertas_avisadas(uuid[]);
drop function if exists public.alertas_por_avisar();
drop function if exists public.resolver_alerta(uuid);
drop function if exists public.resolver_alerta_clave(text);
drop function if exists public.registrar_alerta(text, text, text, text, text, integer);
drop function if exists public.reanudar_pagos(text);
drop function if exists public.parar_pagos(text, text);
drop function if exists public.estado_paradas();
drop table if exists public.alertas_operativas;
alter table public.config_pagos
  drop column if exists parada_cobros,
  drop column if exists parada_devoluciones,
  drop column if exists parada_motivo,
  drop column if exists parada_en;
