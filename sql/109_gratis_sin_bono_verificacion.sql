-- Verificación de 109 (solo lectura). Esperado: condicion = true, trigger = true y reservas_gratis_con_bono = 0.
select position('una sesión gratuita' in pg_get_functiondef('public.reservar_clase(uuid)'::regprocedure)) > 0 as condicion,
       exists (select 1 from pg_trigger where tgname = 'trg_liberar_bono_si_gratis') as trigger,
       (select count(*) from public.reservas r join public.clases c on c.id = r.clase_id
          left join public.bonos_clientes bc on bc.id = r.bono_cliente_id
         where coalesce(c.precio, 0) = 0 and r.bono_cliente_id is not null
           and to_jsonb(bc) ->> 'anulado_en' is null) as reservas_gratis_con_bono;
