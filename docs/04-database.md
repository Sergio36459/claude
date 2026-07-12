# Этап 4. Структура базы данных

PostgreSQL 16 + PostGIS 3.4. ORM — Prisma; геометрия — через `Unsupported("geometry(...)")` + типизированный raw SQL в `packages/db` (Prisma не умеет PostGIS-операции нативно — это осознанное решение, см. самопроверку).

SRID: хранение — **EPSG:4326**; расчёт площадей — через `geography` или проекцию **EPSG:6381/UTM 36N** для точности по Украине.

## 1. ER-обзор

```
sources ─┬─< event_sources >─ events ── event_translations
         ├─< personnel_loss_estimates
         ├─< equipment_loss_records
         └─< control_snapshots / frontlines (source атрибуцией)

days ──┬── control_snapshots (по сторонам)
       ├── control_deltas
       ├── frontlines
       ├── daily_stats
       └── events (по дате)

places (газетир) ──< events (опциональная привязка)
operations ──< events
import_runs ──< * (провенанс каждой записи)
```

## 2. Таблицы

### 2.1. Справочники

```sql
-- Источники данных
CREATE TABLE sources (
  id            SMALLSERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,        -- 'isw','acled','oryx','deepstate',
                                             -- 'ua_general_staff','ru_mod',
                                             -- 'bbc_mediazona','ualosses'
  name          TEXT NOT NULL,
  url           TEXT,
  kind          TEXT NOT NULL,               -- 'research','conflict_db','visual_confirm',
                                             -- 'operational_map','official_ua','official_ru','named_casualties'
  reliability_note TEXT,                     -- ограничения источника для страницы методологии
  priority      SMALLINT NOT NULL            -- 1=ISW … по ТЗ
);

-- Газетир: области, города, нас. пункты (для поиска и привязки)
CREATE TABLE places (
  id            BIGSERIAL PRIMARY KEY,
  kind          TEXT NOT NULL,               -- 'oblast','raion','city','town','village','object'
  name_uk       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  name_alt      TEXT[],                      -- варианты написания для поиска
  admin_parent_id BIGINT REFERENCES places(id),
  geom          geometry(Point,4326),
  boundary      geometry(MultiPolygon,4326), -- для областей/районов
  population    INT,
  search_tsv    tsvector GENERATED ALWAYS AS (
                  to_tsvector('simple', name_uk || ' ' || name_en || ' ' ||
                  coalesce(array_to_string(name_alt,' '),''))) STORED
);
CREATE INDEX places_geom_gix ON places USING GIST (geom);
CREATE INDEX places_tsv_ix   ON places USING GIN (search_tsv);
CREATE INDEX places_trgm_ix  ON places USING GIN (name_en gin_trgm_ops);

-- Операции/сражения ("Битва за Киев", "Харьковское контрнаступление")
CREATE TABLE operations (
  id         SERIAL PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  title_uk   TEXT NOT NULL, title_en TEXT NOT NULL,
  date_start DATE NOT NULL, date_end DATE,
  area       geometry(MultiPolygon,4326)
);

-- Журнал импортов (провенанс)
CREATE TABLE import_runs (
  id          BIGSERIAL PRIMARY KEY,
  source_id   SMALLINT REFERENCES sources(id),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL,                 -- 'running','ok','failed'
  stats       JSONB,                         -- счётчики, ошибки
  etl_version TEXT NOT NULL
);
```

### 2.2. Календарь и агрегаты дня

```sql
CREATE TABLE days (
  date            DATE PRIMARY KEY,          -- начиная с 2022-02-24
  is_published    BOOLEAN NOT NULL DEFAULT false,
  publish_version INT NOT NULL DEFAULT 0,    -- инкремент при переиздании дня
  is_preliminary  BOOLEAN NOT NULL DEFAULT true,
  published_at    TIMESTAMPTZ
);

-- Предрасчитанная статистика дня (источник для правой панели и графиков)
CREATE TABLE daily_stats (
  date            DATE PRIMARY KEY REFERENCES days(date),
  area_ru_sqkm    NUMERIC(10,1),             -- площадь под контролем РФ (канон. геометрия)
  area_change_sqkm NUMERIC(8,2),             -- дельта за день (+ = продвижение РФ)
  frontline_len_km NUMERIC(8,1),
  events_total    INT NOT NULL DEFAULT 0,
  events_by_type  JSONB NOT NULL DEFAULT '{}',  -- {"shelling": 12, "missile": 3, ...}
  strikes_missile INT, strikes_uav INT,
  computed_at     TIMESTAMPTZ NOT NULL
);
```

### 2.3. Геоданные (снапшот + дельта, улучшение №13)

```sql
-- 'ru' = РФ и подконтрольные, 'ua' = Украина, 'contested' = серая зона
CREATE TYPE control_side AS ENUM ('ru','ua','contested');

-- Полные снапшоты зон контроля: каждый день для 'ru'/'contested'
-- (зона 'ua' = территория Украины минус остальные — не хранится)
CREATE TABLE control_snapshots (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL REFERENCES days(date),
  side        control_side NOT NULL,
  geom        geometry(MultiPolygon,4326) NOT NULL,
  is_keyframe BOOLEAN NOT NULL DEFAULT false, -- true: полная геометрия хранится всегда;
                                              -- не-keyframe дни могут восстанавливаться из дельт
  source_id   SMALLINT NOT NULL REFERENCES sources(id),
  import_run_id BIGINT REFERENCES import_runs(id),
  UNIQUE (date, side)
);
CREATE INDEX control_snapshots_gix ON control_snapshots USING GIST (geom);

-- Дельты между соседними днями (готовые слои "занято/освобождено")
CREATE TYPE delta_kind AS ENUM ('gained_ru','gained_ua'); -- с чьей т.з. изменение
CREATE TABLE control_deltas (
  id        BIGSERIAL PRIMARY KEY,
  date      DATE NOT NULL REFERENCES days(date),   -- день, на который наступило изменение
  kind      delta_kind NOT NULL,
  geom      geometry(MultiPolygon,4326) NOT NULL,
  area_sqkm NUMERIC(8,2) NOT NULL,
  UNIQUE (date, kind)
);
CREATE INDEX control_deltas_gix ON control_deltas USING GIST (geom);

-- Линия фронта (каноническая, для интерполяции на клиенте)
CREATE TABLE frontlines (
  date      DATE PRIMARY KEY REFERENCES days(date),
  geom      geometry(MultiLineString,4326) NOT NULL,
  length_km NUMERIC(8,1) NOT NULL,
  source_id SMALLINT NOT NULL REFERENCES sources(id)
);

-- Направления наступлений (стрелки)
CREATE TABLE advance_axes (
  id       BIGSERIAL PRIMARY KEY,
  date     DATE NOT NULL REFERENCES days(date),
  side     control_side NOT NULL,
  geom     geometry(LineString,4326) NOT NULL,  -- от→до, рендерится стрелкой
  label    TEXT,
  source_id SMALLINT NOT NULL REFERENCES sources(id)
);
```

### 2.4. События

```sql
CREATE TYPE event_type AS ENUM (
  'front_change','combat','missile_strike','uav_strike','airstrike',
  'international','political','economic','sanctions','statement','other'
);
CREATE TYPE confidence AS ENUM ('confirmed','reported','claimed','disputed');

CREATE TABLE events (
  id            BIGSERIAL PRIMARY KEY,
  date          DATE NOT NULL REFERENCES days(date),
  time_utc      TIME,                          -- может отсутствовать
  type          event_type NOT NULL,
  title         TEXT NOT NULL,                 -- язык по умолчанию (en)
  description   TEXT,
  geom          geometry(Point,4326),          -- NULL для негеопривязанных
  place_id      BIGINT REFERENCES places(id),
  operation_id  INT REFERENCES operations(id),
  confidence    confidence NOT NULL,
  is_key_event  BOOLEAN NOT NULL DEFAULT false, -- маркер на таймлайне
  import_run_id BIGINT REFERENCES import_runs(id),
  dedup_group   BIGINT,                        -- события-дубли из разных источников
  search_tsv    tsvector GENERATED ALWAYS AS
                (to_tsvector('simple', title || ' ' || coalesce(description,''))) STORED
);
CREATE INDEX events_date_ix ON events (date);
CREATE INDEX events_type_date_ix ON events (type, date);
CREATE INDEX events_gix ON events USING GIST (geom);
CREATE INDEX events_tsv_ix ON events USING GIN (search_tsv);

-- Локализации (i18n контента, улучшение №15)
CREATE TABLE event_translations (
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  lang     TEXT NOT NULL,                      -- 'uk','en',...
  title    TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (event_id, lang)
);

-- Источники события: >=1 на событие (инвариант ТЗ), проверяется на publish
CREATE TABLE event_sources (
  event_id     BIGINT REFERENCES events(id) ON DELETE CASCADE,
  source_id    SMALLINT REFERENCES sources(id),
  url          TEXT NOT NULL,
  source_ref   TEXT,                           -- id записи в источнике (ACLED event_id...)
  published_at TIMESTAMPTZ,
  PRIMARY KEY (event_id, source_id, url)
);
```

### 2.5. Потери — по источникам, без слияния

```sql
CREATE TYPE loss_side AS ENUM ('ru','ua');

-- Личный состав: КУМУЛЯТИВНЫЕ оценки на дату, одна строка = один источник
CREATE TABLE personnel_loss_estimates (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL REFERENCES days(date),
  side        loss_side NOT NULL,
  source_id   SMALLINT NOT NULL REFERENCES sources(id),
  metric      TEXT NOT NULL,          -- 'killed','killed_confirmed_named','casualties_total'
  value_min   INT NOT NULL,           -- точечная оценка: min=max
  value_max   INT NOT NULL,
  method_note TEXT,                   -- напр. 'нижняя граница, поимённое подтверждение'
  url         TEXT NOT NULL,
  import_run_id BIGINT REFERENCES import_runs(id),
  UNIQUE (date, side, source_id, metric)
);
CREATE INDEX ple_series_ix ON personnel_loss_estimates (side, source_id, metric, date);

-- Техника: кумулятив на дату по категориям, одна строка = источник×категория×статус
CREATE TYPE equipment_category AS ENUM (
  'tank','ifv','apc','artillery','mlrs','air_defense',
  'aircraft','helicopter','uav','ship','other'
);
CREATE TYPE equipment_status AS ENUM ('destroyed','damaged','abandoned','captured','total_claimed');

CREATE TABLE equipment_loss_records (
  id         BIGSERIAL PRIMARY KEY,
  date       DATE NOT NULL REFERENCES days(date),
  side       loss_side NOT NULL,
  source_id  SMALLINT NOT NULL REFERENCES sources(id),
  category   equipment_category NOT NULL,
  status     equipment_status NOT NULL,   -- Oryx детализирует; официальные — 'total_claimed'
  count      INT NOT NULL,
  url        TEXT,
  import_run_id BIGINT REFERENCES import_runs(id),
  UNIQUE (date, side, source_id, category, status)
);
CREATE INDEX elr_series_ix ON equipment_loss_records (side, source_id, category, date);
```

## 3. Ключевые запросы и их поддержка индексами

| Запрос | Механизм |
|--------|----------|
| День D: зоны контроля | `control_snapshots WHERE date=D` (уникальный индекс) |
| Реконструкция не-keyframe дня | ближайший keyframe ≤ D + свёртка `control_deltas` (функция `rebuild_control(date)`) |
| События дня с фильтрами | `events_type_date_ix`, гео-фильтр bbox — `events_gix` |
| Ряды потерь для графика | `ple_series_ix` / `elr_series_ix` — index-only scan по серии |
| Поиск | `places_tsv/trgm` + `events_tsv` UNION с ранжированием |
| «Что изменилось» | `control_deltas WHERE date=D` — готовый ответ |

## 4. Целостность и инварианты (проверки на publish)

1. Событие без записи в `event_sources` — публикация дня падает.
2. `control_snapshots.geom` проходит `ST_IsValid` (ETL прогоняет `ST_MakeValid`).
3. Непрерывность: для каждого опубликованного дня существуют снапшот/фронтлайн (или дельта-цепочка до keyframe).
4. Аномалия-детектор: |area_change_sqkm| > порога → день публикуется с флагом `needs_review`, алерт.
5. Ретро-правки: переиздание дня инкрементирует `days.publish_version` (попадает в manifest → инвалидация CDN/клиентов).

## 5. Prisma

Schema в `packages/db/prisma/schema.prisma`; геометрия — `Unsupported("geometry(MultiPolygon,4326)")`. Все PostGIS-операции (дельты, площади, упрощение, bbox-фильтры) — в слое типизированных raw-запросов `packages/db/src/queries/*.ts` (единственное место сырого SQL в проекте). Миграции — Prisma Migrate + ручные SQL-миграции для индексов GIST/GIN и функций (`rebuild_control`).

---

## Самопроверка этапа 4

- *Почему кумулятивы, а не дневные приросты потерь?* Источники публикуют кумулятивы; приросты выводятся вычитанием и ломаются при ретро-корректировках. Кумулятив — сырьё, прирост — вычисляемое представление (materialized view `personnel_loss_daily` для графиков «в день»). ✔
- *Слабое место: Prisma и PostGIS.* Признано; изоляция сырого SQL в одном пакете с интеграционными тестами (testcontainers) снимает основной риск. Альтернатива (Drizzle/Kysely) отклонена, т.к. стек зафиксирован ТЗ.
- *Размер геоданных:* полный снапшот на каждый день хранится физически только для keyframe (еженедельно) — прочие дни материализуются при генерации статики и не раздувают БД. При этом `UNIQUE(date, side)` допускает и полное хранение, если дельты окажутся хрупкими — схема не меняется.
- *`days.is_preliminary`* закрывает вопрос «сегодняшних» данных: UI показывает бейдж «предварительные данные».
- Обнаружено и исправлено: в `event_sources` первичный ключ включает `url` — одно событие может иметь несколько ссылок одного источника.
