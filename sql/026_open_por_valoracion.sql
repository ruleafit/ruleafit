-- 026_open_por_valoracion.sql
-- Concede 10 Open la PRIMERA vez que un cliente valora a un entrenador.
-- El upsert de valoraciones se ejecuta como INSERT ... ON CONFLICT DO UPDATE:
-- un trigger AFTER INSERT solo se dispara en la inserción real (primera valoración);
-- las ediciones posteriores son UPDATE y NO vuelven a conceder Open.
-- Con UNIQUE(cliente_id, entrenador_id) + sin DELETE en RLS, es imposible cobrar dos
-- veces por el mismo entrenador. No inserta a mano: delega en public.otorgar_open().

-- 1) Nuevo motivo en el catálogo (idempotente)
insert into public.open_motivos (codigo, descripcion)
values ('valoracion_realizada', 'Primera valoración a un entrenador')
on conflict (codigo) do nothing;

-- 2) Función del trigger (SECURITY DEFINER, delega en otorgar_open)
create or replace function public.otorgar_open_valoracion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.otorgar_open(
        p_usuario_id      => new.cliente_id,
        p_cantidad        => 10,
        p_motivo          => 'valoracion_realizada',
        p_referencia_tipo => 'valoracion',
        p_referencia_id   => new.id,
        p_otorgado_por    => null,
        p_nota            => null
    );
    return new;
end;
$$;

-- 3) Trigger AFTER INSERT (solo primera valoración; las ediciones son UPDATE y no disparan)
drop trigger if exists on_valoracion_created_otorgar_open on public.valoraciones;
create trigger on_valoracion_created_otorgar_open
    after insert on public.valoraciones
    for each row
    execute function public.otorgar_open_valoracion();
