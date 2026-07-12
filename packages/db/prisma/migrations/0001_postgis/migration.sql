-- Расширения и объекты, которые Prisma Migrate не описывает сам:
-- GIST/GIN-индексы, tsvector-колонки и функция реконструкции дня.
-- Применяется ПОСЛЕ базовой миграции схемы (prisma migrate dev создаст таблицы).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Пространственные индексы (docs/04 §2)
CREATE INDEX IF NOT EXISTS places_geom_gix ON places USING GIST (geom);
CREATE INDEX IF NOT EXISTS control_snapshots_gix ON control_snapshots USING GIST (geom);
CREATE INDEX IF NOT EXISTS control_deltas_gix ON control_deltas USING GIST (geom);
CREATE INDEX IF NOT EXISTS events_gix ON events USING GIST (geom);

-- Полнотекстовый поиск
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', name_uk || ' ' || name_en || ' ' ||
      coalesce(array_to_string(name_alt, ' '), ''))
  ) STORED;
CREATE INDEX IF NOT EXISTS places_tsv_ix ON places USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS places_trgm_ix ON places USING GIN (name_en gin_trgm_ops);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', title || ' ' || coalesce(description, ''))
  ) STORED;
CREATE INDEX IF NOT EXISTS events_tsv_ix ON events USING GIN (search_tsv);

-- Реконструкция зоны контроля для не-keyframe дня (снапшот + дельты, docs/04 §3)
CREATE OR REPLACE FUNCTION rebuild_control(p_date date, p_side control_side)
RETURNS geometry AS $$
DECLARE
  kf_date date;
  geom_acc geometry;
  delta RECORD;
BEGIN
  SELECT date, geom INTO kf_date, geom_acc
  FROM control_snapshots
  WHERE side = p_side AND is_keyframe AND date <= p_date
  ORDER BY date DESC LIMIT 1;

  IF geom_acc IS NULL THEN
    RETURN NULL;
  END IF;

  FOR delta IN
    SELECT kind, geom FROM control_deltas
    WHERE date > kf_date AND date <= p_date
    ORDER BY date
  LOOP
    IF delta.kind = 'gained_ru' THEN
      geom_acc := ST_Union(geom_acc, delta.geom);
    ELSE
      geom_acc := ST_Difference(geom_acc, delta.geom);
    END IF;
  END LOOP;

  RETURN ST_Multi(geom_acc);
END;
$$ LANGUAGE plpgsql STABLE;
