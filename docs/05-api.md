# Этап 5. Проектирование API

Два канала доставки данных (см. этап 3):

1. **Статический data-контракт** (CDN, объектное хранилище) — основной путь чтения.
2. **REST API `/api/v1`** (NestJS) — поиск, произвольные фильтры, экспорт, служебные операции.

Оба канала описываются одними zod-схемами из `packages/shared`; OpenAPI генерируется из них автоматически.

## 1. Статический data-контракт (CDN)

```
GET /data/manifest.json
  → {
      "schemaVersion": 3,
      "firstDate": "2022-02-24",
      "lastDate":  "2026-07-11",
      "days": { "2023-06-06": { "v": 2, "preliminary": false }, ... },
      "series": { "control-area": {"v": 5}, "losses-personnel": {"v": 5}, ... }
    }
  // manifest — единственный мутируемый файл (s-maxage=300);
  // всё остальное — immutable, версия из манифеста добавляется query-параметром ?v=

GET /data/days/{date}/bundle.json?v={v}
  → { date, preliminary,
      stats:  DailyStats,                  // правая панель
      events: Event[],                     // с источниками и confidence
      losses: { personnel: Estimate[], equipment: Record[] },  // на эту дату, по источникам
      diffSummary: { gainedRuSqkm, gainedUaSqkm, byOblast: [...] } }

GET /data/days/{date}/control.z{0|1|2|3}.geojson?v=   // зоны контроля, 4 LOD
GET /data/days/{date}/frontline.geojson?v=            // MultiLineString (детальная)
GET /data/days/{date}/frontline.z0.geojson?v=         // упрощённая для playback
GET /data/days/{date}/diff.geojson?v=                 // gained_ru / gained_ua полигоны
GET /data/days/{date}/axes.geojson?v=                 // стрелки наступлений

GET /data/series/{name}.json?v=      // готовые ряды для графиков:
  // control-area, frontline-length, losses-personnel, losses-equipment,
  // events-intensity — каждый: { series: [{source, side, points:[[date,value],...]}] }

GET /tiles/base.pmtiles              // подложка (границы, города, гидрография)
GET /tiles/history.pmtiles           // (фаза 2) вся история фронта как тайлы с атрибутом даты
```

Формат `Event` (в бандле и в API — идентичен):

```jsonc
{
  "id": 18234,
  "date": "2023-06-06", "timeUtc": "04:50",
  "type": "front_change",
  "title": "…", "description": "…",
  "coords": [33.037, 46.756],          // null, если не геопривязано
  "placeId": 512, "operationId": 7,
  "confidence": "confirmed",           // confirmed|reported|claimed|disputed
  "isKeyEvent": true,
  "sources": [ { "code": "isw", "name": "ISW", "url": "https://…", "publishedAt": "…" } ]
}
```

## 2. REST API `/api/v1`

### 2.1. Дни и геоданные (зеркало статики для динамических сценариев)

```
GET /api/v1/days/{date}                  → DayBundle (как bundle.json)
GET /api/v1/days/{date}/geo/control?lod=0..3
GET /api/v1/days/{date}/geo/frontline
GET /api/v1/days/{date}/geo/diff
GET /api/v1/geo/diff?from={date}&to={date}   // диф между ЛЮБЫМИ датами (режим сравнения):
                                             // ST_Difference на лету + Redis-кэш
```

### 2.2. События

```
GET /api/v1/events?from=&to=&type[]=&confidence[]=&bbox=&placeId=&operationId=&q=&cursor=&limit=
  → { items: Event[], nextCursor }         // keyset-пагинация (date,id), limit ≤ 200
GET /api/v1/events/{id}                    → Event + переводы + все источники
```

### 2.3. Потери

```
GET /api/v1/losses/personnel?side=&metric=&sourceCode[]=&from=&to=
  → { series: [{ source, side, metric, methodNote, points: [[date,min,max]] }] }
  // ВСЕГДА массив серий по источникам — API физически не умеет отдавать "среднее"

GET /api/v1/losses/equipment?side=&category[]=&status[]=&sourceCode[]=&from=&to=
  → аналогично, серия = источник×категория×статус

GET /api/v1/losses/summary?date=          → срез на дату для таблицы (все источники колонками)
```

### 2.4. Графики, поиск, справочники, экспорт

```
GET /api/v1/charts/{name}?from=&to=       // те же ряды, что /data/series, но с диапазоном
GET /api/v1/search?q=&types[]=place|event|operation|date&limit=
  → { results: [ { type, id, label, sublabel, coords?, date? } ] }
  // 'date': распознавание "6 июня 2023"/"2023-06-06" → прыжок по таймлайну
GET /api/v1/places/{id} · GET /api/v1/operations · GET /api/v1/sources
GET /api/v1/export?entity=events|losses|control&from=&to=&format=csv|geojson|json
```

### 2.5. Служебные (bearer-токен сервисного аккаунта, не публичные)

```
POST /api/v1/internal/publish/{date}      // запуск publish-шага ETL
POST /api/v1/internal/revalidate          // сброс Redis по манифесту
GET  /api/v1/internal/import-runs
```

## 3. Соглашения

- **Версионирование**: путь `/api/v1`; несовместимые изменения → `/api/v2`, `schemaVersion` в манифесте для статики.
- **Ошибки**: RFC 7807 (`application/problem+json`), коды `DATE_OUT_OF_RANGE`, `DAY_NOT_PUBLISHED`, `VALIDATION_ERROR`…
- **Кэш-заголовки**: исторические даты `Cache-Control: public, max-age=86400, s-maxage=31536000` + `ETag`; последняя дата — `s-maxage=300`; поиск — `no-store`.
- **CORS**: только собственные домены + `GET` для экспорта всем.
- **Rate limit**: 60 rpm на IP для search/export, остальное покрывает CDN.
- **Даты**: везде ISO `YYYY-MM-DD`, время UTC; клиент не оперирует локальными зонами (день = день по Киеву, это зафиксировано в методологии).

## 4. Типичные сценарии → запросы

| Сценарий | Запросы |
|----------|---------|
| Открытие сайта | manifest → bundle+control+frontline последней даты (3 файла с CDN) |
| Шаг −1 день | всё уже в кэше React Query (prefetch D±1) |
| Playback 10x | prefetch окна D+1..D+20: только `frontline.z0` + `control.z0` + `diff` |
| Сравнение дат | `/api/v1/geo/diff?from&to` (кэшируется в Redis по паре дат) |
| Поиск «Бахмут» | `/api/v1/search?q=` → place → камера + подгрузка активной даты |
| График потерь | `/data/series/losses-personnel.json` — один файл, фильтрация на клиенте |

---

## Самопроверка этапа 5

- *Дублирование статики и API* — осознанное: контракт один (zod), генераторы бандлов и контроллеры используют одни сериализаторы; тест сравнивает вывод обоих путей на эталонном дне. ✔
- *Слабое место: `diff` между произвольными датами* — тяжёлая PostGIS-операция. Ограничения: только пары опубликованных дат, кэш Redis, таймаут 5 с, при превышении — предложение выбрать keyframe-даты. Для популярных пар (полгода/год назад) — пре-генерация.
- *Пагинация событий* — keyset вместо offset: устойчива к дозаписи и дешевле на больших датах. ✔
- *Экспорт* — потоковая выгрузка (NestJS StreamableFile), лимит диапазона 1 год на запрос, чтобы не выстрелить себе в ногу.
- Обнаружено при проверке: у losses-эндпоинтов нельзя допустить дефолт «все источники слиты» при пустом `sourceCode[]` — дефолт возвращает все серии раздельно; агрегирующего параметра в API нет вообще (инвариант ТЗ на уровне контракта).
