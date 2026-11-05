-- ============================================================================
--  AUSENTISMO — Cálculo dentro de la base de datos
--  Traer todos los registros del mes al servidor supera el límite de
--  peticiones de Cloudflare. Esta función devuelve el resumen ya agregado:
--  una fila por trabajador, en una sola consulta.
--  Corre este archivo una vez en el SQL Editor de Supabase.
-- ============================================================================

create or replace function ausentismo_datos(p_desde date, p_hasta date)
returns table (
  cedula        text,
  dias_labor    int,     -- días distintos con reporte de labor
  horas_vig     numeric, -- horas de vigilancia en el periodo
  dias_vac      int,     -- días marcados como vacaciones (novedad 13)
  novedades     text     -- "AAAA-MM-DD:codigo" separados por coma
)
language sql
stable
as $$
  select
    d.cedula::text,
    count(distinct d.fecha) filter (where d.tipo = 'labor')::int,
    coalesce(sum(coalesce(d.vig_hd, 0) + coalesce(d.vig_hn, 0)), 0),
    count(distinct d.fecha) filter (where upper(coalesce(d.novedad, '')) = '13')::int,
    string_agg(
      distinct d.fecha::text || ':' || upper(coalesce(d.novedad, '')),
      ','
    ) filter (
      where coalesce(d.novedad, '') <> ''
        and coalesce(d.tipo, '') <> 'labor'
        and upper(coalesce(d.novedad, '')) <> '13'
    )
  from detalle_dia d
  where d.fecha between p_desde and p_hasta
  group by d.cedula;
$$;

-- Permitir que la aplicación la ejecute
grant execute on function ausentismo_datos(date, date) to anon, authenticated, service_role;

-- Índice para que la consulta sea rápida
create index if not exists idx_detalle_fecha_ced on detalle_dia(fecha, cedula);

-- Prueba:
-- select * from ausentismo_datos('2026-10-01','2026-10-31') limit 5;
