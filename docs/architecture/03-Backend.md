---
tags:
  - docs
  - architecture
  - backend
---

# Backend

> [!abstract]
> Backend состоит из двух слоёв документации: прикладной backend-контур и отдельный database-контур. Этот файл служит входной точкой и короткой картой.

## Роль backend

Backend выступает как API-, auth- и orchestration-layer платформы. Он управляет доступом пользователей, жизненным циклом исследовательских сессий, хранит артефакты гипотез и публикует состояние системы для frontend.

## Что входит в backend-контур

- `API layer` — маршруты, зависимости, auth guards и HTTP-контракты;
- `service layer` — бизнес-правила, транзакции и orchestration;
- `repository layer` — чтение и запись в PostgreSQL;
- `identity and access` — login, refresh, logout, управление пользователями;
- `db-init` — применение миграций, bootstrap superadmin и запуск seed-пакетов;
- `research pipeline` — document ingestion, retrieval, debate, evaluation и judge.

## Логическая структура

```text
backend/app/
├── api/            - routers, dependencies, auth guards, HTTP contracts
├── core/           - settings, security config, shared policies
├── db/             - engine, session factory, naming convention
├── models/         - SQLAlchemy entities and enums
├── repositories/   - persistence access without business rules
├── schemas/        - Pydantic request/response models
├── security/       - password hashing, JWT, refresh token hashing
├── services/       - business logic and transaction boundaries
├── orchestrators/  - research pipeline flows
├── seed/           - bootstrap and static seed execution
└── workers/        - long-running or async jobs
```

## Рабочее правило слоя

Backend следует явной цепочке `router -> service -> repository -> model/db`.
HTTP-слой остаётся тонким, бизнес-решения живут в сервисах, а репозитории отвечают только за persistence.

## Детальные разделы

- [[backend/01-Backend-Overview]] — состав backend и пакетная структура.
- [[backend/02-Authentication-and-Tokens]] — логин, refresh rotation, logout и политика сессий.
- [[backend/03-Users-and-Admin]] — CRUD пользователей, self-service и ограничения суперпользователя.
- [[backend/04-Db-Init-and-Seeds]] — жизненный цикл `db-init`, миграции и первичные seed-паки.
- [[database/01-Identity-and-Auth-Schema]] — схема таблиц auth и identity.
- [[database/02-Constraints-Indexes-and-Checks]] — checks, indexes, оптимизация и naming convention.

## Связанные документы

- [[02-System-Architecture]]
- [[backend/00-INDEX]]
- [[database/00-INDEX]]
- [[05-Data-and-Retrieval]]
- [[product/03-Hypothesis-Pipeline]]
