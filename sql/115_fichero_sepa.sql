-- ============================================================================
-- Ruleafit · 115_fichero_sepa.sql
-- Requiere sql/114. No envía dinero: agrupa transferencias pendientes en un fichero para el banco y las marca en
-- bloque. Repetible.
-- Contra el pago doble: cada transferencia entra en UN solo fichero. El mismo fichero se puede volver a descargar
-- (mismo identificador); para rehacerlo hay que descartarlo, y solo si no se ha subido al banco.
-- Datos del ordenante (nombre, identificador, IBAN): variables de entorno de la web, no se guardan aquí.
-- Cierre automático: 115_fichero_sepa_cron.sql (no ejecutarlo hasta tener los pagos en marcha).
-- Reversión: sql/115_fichero_sepa_reversion.sql.
-- ============================================================================
create table if not exists public.ficheros_sepa (
  id          uuid primary key default gen_random_uuid(),
  referencia  text not null unique check (char_length(referencia) <= 35),
  estado      text not null default 'generado' check (estado in ('generado', 'enviado', 'descartado')),
  creado_en   timestamptz not null default now(),
  cerrado_en  timestamptz
);
alter table public.ficheros_sepa enable row level security;
revoke all on public.ficheros_sepa from anon, authenticated; -- solo servicio
grant select on public.ficheros_sepa to service_role;

alter table public.liquidaciones_lineas
  add column if not exists fichero_id uuid references public.ficheros_sepa(id) on delete set null;

-- Una línea anulada que vuelve a «pendiente» (nuevo cierre) sale de su fichero antiguo.
create or replace function public.linea_sale_del_fichero()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.estado = 'anulada' and new.estado = 'pendiente' then
    new.fichero_id := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_linea_sale_del_fichero on public.liquidaciones_lineas;
create trigger trg_linea_sale_del_fichero before update of estado on public.liquidaciones_lineas
  for each row execute function public.linea_sale_del_fichero();

-- Transferencias que pueden entrar en un fichero nuevo: pendientes, sin fichero y con el mismo IBAN que al cerrar.
create or replace function public.lineas_para_fichero()
returns table (linea_id uuid, importe_centimos bigint, utilizable boolean)
language sql
stable
security definer
set search_path = public
as $$
  select ll.id, ll.importe_centimos,
         coalesce(f.estado = 'activo' and f.iban_cifrado is not null and f.iban_ultimos4 = ll.iban_ultimos4, false)
    from public.liquidaciones_lineas ll
    left join public.perfiles_fiscales f on f.usuario_id = ll.entrenador_id
   where ll.estado = 'pendiente' and ll.fichero_id is null
$$;

create or replace function public.preparar_fichero_sepa()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_n  integer;
begin
  perform pg_advisory_xact_lock(hashtext('liquidaciones'));
  if not exists (select 1 from public.lineas_para_fichero() where utilizable) then
    raise exception 'No hay transferencias nuevas para incluir en un fichero.' using errcode = 'P0001';
  end if;
  insert into public.ficheros_sepa (id, referencia)
  values (v_id, 'RULEAFIT-' || to_char(now() at time zone 'Europe/Madrid', 'YYYYMMDD-HH24MI') || '-'
                || upper(left(replace(v_id::text, '-', ''), 8)));
  update public.liquidaciones_lineas set fichero_id = v_id
   where id in (select linea_id from public.lineas_para_fichero() where utilizable);
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'fichero_id', v_id, 'transferencias', v_n);
end;
$$;

-- Contenido de un fichero sin enviar. Descifra los IBAN: solo servidor, a petición de administración.
create or replace function public.datos_fichero_sepa(p_fichero uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f       public.ficheros_sepa%rowtype;
  v_clave   text;
  v_lineas  jsonb;
begin
  select * into v_f from public.ficheros_sepa where id = p_fichero;
  if not found or v_f.estado <> 'generado' then
    raise exception 'Este fichero ya no se puede descargar.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.liquidaciones_lineas ll
              left join public.perfiles_fiscales f on f.usuario_id = ll.entrenador_id
             where ll.fichero_id = p_fichero and ll.estado = 'pendiente'
               and (f.estado is distinct from 'activo' or f.iban_ultimos4 is distinct from ll.iban_ultimos4)) then
    raise exception 'Los datos bancarios de algún organizador han cambiado. Descarta este fichero y revisa esa transferencia.'
      using errcode = 'P0001';
  end if;
  select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'iban_clave';
  select jsonb_agg(jsonb_build_object(
           'referencia', replace(ll.id::text, '-', ''),
           'titular', f.titular_iban,
           'iban', extensions.pgp_sym_decrypt(f.iban_cifrado, v_clave),
           'importe_centimos', ll.importe_centimos,
           'concepto', 'RULEAFIT liquidacion ' || to_char(l.fecha_pago, 'DD-MM-YYYY'),
           'fecha_pago', l.fecha_pago) order by l.fecha_pago, ll.id)
    into v_lineas
    from public.liquidaciones_lineas ll
    join public.liquidaciones l on l.id = ll.liquidacion_id
    join public.perfiles_fiscales f on f.usuario_id = ll.entrenador_id
   where ll.fichero_id = p_fichero and ll.estado = 'pendiente';
  if v_lineas is null then
    raise exception 'El fichero no tiene transferencias pendientes.' using errcode = 'P0001';
  end if;
  return jsonb_build_object('referencia', v_f.referencia, 'creado_en', v_f.creado_en, 'transferencias', v_lineas);
end;
$$;

-- «enviado»: se ha subido y firmado en el banco; marca todas como transferidas.
-- «descartado»: NO se ha subido; las transferencias quedan libres para otro fichero.
create or replace function public.cerrar_fichero_sepa(p_fichero uuid, p_estado text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f public.ficheros_sepa%rowtype;
  r   record;
  v_n integer := 0;
begin
  if p_estado not in ('enviado', 'descartado') then
    raise exception 'Estado no válido.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('liquidaciones'));
  select * into v_f from public.ficheros_sepa where id = p_fichero for update;
  if not found or v_f.estado <> 'generado' then
    raise exception 'Este fichero ya está cerrado.' using errcode = 'P0001';
  end if;
  if p_estado = 'enviado' then
    for r in select id from public.liquidaciones_lineas where fichero_id = p_fichero and estado = 'pendiente' order by id
    loop
      perform public.marcar_linea_liquidacion(r.id, 'pagada');
      v_n := v_n + 1;
    end loop;
  else
    if exists (select 1 from public.liquidaciones_lineas where fichero_id = p_fichero and estado = 'pagada') then
      raise exception 'Alguna transferencia de este fichero ya está marcada como hecha: no se puede descartar.' using errcode = 'P0001';
    end if;
    update public.liquidaciones_lineas set fichero_id = null where fichero_id = p_fichero;
    get diagnostics v_n = row_count;
  end if;
  update public.ficheros_sepa set estado = p_estado, cerrado_en = now() where id = p_fichero;
  return jsonb_build_object('ok', true, 'transferencias', v_n);
end;
$$;

-- Datos del panel (sin IBAN).
create or replace function public.panel_ficheros_sepa()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nuevas', (select count(*) from public.lineas_para_fichero() where utilizable),
    'nuevas_centimos', (select coalesce(sum(importe_centimos), 0) from public.lineas_para_fichero() where utilizable),
    'bloqueadas', (select count(*) from public.lineas_para_fichero() where not utilizable),
    'ficheros', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.creado_en desc)
        from (select f.id, f.referencia, f.estado, f.creado_en,
                     count(ll.id) filter (where ll.estado <> 'anulada') as transferencias,
                     coalesce(sum(ll.importe_centimos) filter (where ll.estado <> 'anulada'), 0) as total_centimos
                from public.ficheros_sepa f
                left join public.liquidaciones_lineas ll on ll.fichero_id = f.id
               group by f.id
               order by f.creado_en desc limit 20) x), '[]'::jsonb))
$$;

revoke all on function public.linea_sale_del_fichero(), public.lineas_para_fichero(), public.preparar_fichero_sepa(),
  public.datos_fichero_sepa(uuid), public.cerrar_fichero_sepa(uuid, text), public.panel_ficheros_sepa()
  from public, anon, authenticated;
grant execute on function public.preparar_fichero_sepa(), public.datos_fichero_sepa(uuid),
  public.cerrar_fichero_sepa(uuid, text), public.panel_ficheros_sepa() to service_role;
