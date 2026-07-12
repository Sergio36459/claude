# Ukraine War Timeline (UWT)

Интерактивная веб-платформа с хронологией войны в Украине: карта + временная шкала с 24.02.2022, синхронное изменение линии фронта, зон контроля, событий, статистики, потерь и графиков при выборе любой даты, с анимированным воспроизведением развития конфликта.

Ключевые принципы: **проверяемость каждого факта** (обязательные ссылки на источники, оценки разных источников никогда не сливаются), высокая производительность (статическая пре-генерация данных, PMTiles, WebGL), масштабируемая архитектура.

## Статус

**Этап проектирования завершён — ожидает утверждения.** Код пишется после утверждения документов (см. регламент работы: проектирование → утверждение → разработка).

## Проектная документация

| Документ | Содержание |
|----------|-----------|
| [docs/01-requirements-analysis.md](docs/01-requirements-analysis.md) | Анализ требований, инварианты данных, риски, границы MVP |
| [docs/02-improvements.md](docs/02-improvements.md) | 17 предлагаемых улучшений (какие включены в MVP) |
| [docs/03-architecture.md](docs/03-architecture.md) | Архитектура: монорепо, frontend, API, ETL, кэширование, DevOps |
| [docs/04-database.md](docs/04-database.md) | PostgreSQL + PostGIS: полная схема, индексы, инварианты publish |
| [docs/05-api.md](docs/05-api.md) | Статический data-контракт (CDN) + REST API /api/v1 |
| [docs/06-geodata.md](docs/06-geodata.md) | GeoJSON-форматы, LOD, снапшот+дельта, анимация смены даты, PMTiles |
| [docs/07-ui-ux.md](docs/07-ui-ux.md) | Макеты, адаптивность, дизайн-система, компоненты, горячие клавиши |
| [docs/08-development-plan.md](docs/08-development-plan.md) | План: 5 фаз, ~12.5 недель до релиза, Definition of Done |

## Технологический стек (утверждённый)

Next.js · React · TypeScript · Tailwind CSS · Framer Motion · MapLibre GL JS · React Query · Zustand · NestJS · Prisma · PostgreSQL + PostGIS · GeoJSON + Vector Tiles (PMTiles) · OpenStreetMap.

## Источники данных (в порядке приоритета)

ISW → ACLED → Oryx → DeepState (со сверкой) → официальные заявления сторон (отдельными колонками) → поимённые проекты (BBC/Mediazona, UALosses — как подтверждённые случаи, нижняя граница).
