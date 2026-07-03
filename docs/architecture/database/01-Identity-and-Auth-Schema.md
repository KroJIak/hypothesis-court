---
tags:
  - docs
  - architecture
  - database
  - auth
---

# Схема Identity И Auth

## База данных identity-контура

Для стартового backend-функционала используются четыре основные таблицы:

- `users`
- `auth_refresh_sessions`
- `audit_events`
- `app_seed_runs`

## PostgreSQL extensions

- `citext` — case-insensitive `username`
- `pgcrypto` — `gen_random_uuid()`
- `pgvector` — включается в основном research-контуре, но не обязателен для identity-модуля

## ER-диаграмма

```mermaid
erDiagram
    USERS ||--o{ AUTH_REFRESH_SESSIONS : owns
    USERS ||--o{ AUDIT_EVENTS : acts_in
    USERS ||--o{ AUDIT_EVENTS : targeted_in
    USERS o|--o{ USERS : created_by
    USERS o|--o{ USERS : deleted_by
    AUTH_REFRESH_SESSIONS o|--o| AUTH_REFRESH_SESSIONS : parent_of

    USERS {
        UUID id PK
        CITEXT username UK
        TEXT password_hash
        BOOLEAN is_admin
        BOOLEAN is_superadmin
        VARCHAR first_name
        VARCHAR last_name
        USER_STATUS status
        BIGINT token_version
        UUID created_by_user_id FK
        UUID deleted_by_user_id FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ deleted_at
    }

    AUTH_REFRESH_SESSIONS {
        UUID id PK
        UUID user_id FK
        UUID family_id
        UUID parent_session_id FK
        UUID replaced_by_session_id FK
        TEXT refresh_token_hash UK
        TIMESTAMPTZ issued_at
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ last_used_at
        TIMESTAMPTZ revoked_at
        REFRESH_REVOKE_REASON revoked_reason
        INET ip_address
        TEXT user_agent
        TIMESTAMPTZ created_at
    }

    AUDIT_EVENTS {
        BIGINT id PK
        UUID actor_user_id FK
        UUID target_user_id FK
        AUDIT_EVENT_TYPE event_type
        JSONB payload
        TIMESTAMPTZ created_at
    }

    APP_SEED_RUNS {
        TEXT seed_key PK
        TEXT checksum
        JSONB payload
        TIMESTAMPTZ applied_at
    }
```

## Нотация Чена

```mermaid
flowchart LR
    U[USERS]
    S[AUTH_REFRESH_SESSIONS]
    A[AUDIT_EVENTS]
    R[APP_SEED_RUNS]

    OWN{OWNS}
    ACT{ACTS IN}
    TAR{TARGETS}
    CRT{CREATES}
    DEL{DELETES}
    PAR{PARENT OF}

    U -->|"1"| OWN
    OWN -->|"N"| S

    U -->|"1"| ACT
    ACT -->|"N"| A

    U -->|"1"| TAR
    TAR -->|"N"| A

    U -->|"0..1"| CRT
    CRT -->|"N"| U

    U -->|"0..1"| DEL
    DEL -->|"N"| U

    S -->|"0..1"| PAR
    PAR -->|"0..1"| S

    R
```

## Таблица `users`

### Назначение

Хранит все внутренние учётные записи платформы.

### Поля

| Поле | Тип | Назначение |
| --- | --- | --- |
| `id` | `uuid` | первичный ключ |
| `username` | `citext` | уникальный логин без чувствительности к регистру |
| `password_hash` | `text` | Argon2id hash |
| `is_admin` | `boolean` | административный доступ |
| `is_superadmin` | `boolean` | системный суперпользователь |
| `first_name` | `varchar(100)` | необязательное имя |
| `last_name` | `varchar(100)` | необязательная фамилия |
| `status` | `user_status` | `active`, `inactive`, `deleted` |
| `token_version` | `bigint` | версия access token |
| `created_by_user_id` | `uuid` | кто создал пользователя |
| `deleted_by_user_id` | `uuid` | кто удалил пользователя |
| `created_at` | `timestamptz` | время создания |
| `updated_at` | `timestamptz` | время обновления |
| `deleted_at` | `timestamptz` | время логического удаления |

## Таблица `auth_refresh_sessions`

### Назначение

Хранит каждую refresh session как отдельную запись, чтобы backend мог:

- делать безопасную ротацию refresh token;
- отзывать отдельную сессию или все сессии пользователя;
- обнаруживать reuse скомпрометированного токена.

### Поля

| Поле | Тип | Назначение |
| --- | --- | --- |
| `id` | `uuid` | первичный ключ сессии |
| `user_id` | `uuid` | владелец сессии |
| `family_id` | `uuid` | семейство ротации |
| `parent_session_id` | `uuid` | предыдущая сессия в цепочке |
| `replaced_by_session_id` | `uuid` | следующая сессия после rotation |
| `refresh_token_hash` | `text` | hash refresh token |
| `issued_at` | `timestamptz` | момент выдачи |
| `expires_at` | `timestamptz` | срок действия |
| `last_used_at` | `timestamptz` | последнее использование |
| `revoked_at` | `timestamptz` | момент отзыва |
| `revoked_reason` | `refresh_revoke_reason` | причина отзыва |
| `ip_address` | `inet` | IP клиента |
| `user_agent` | `text` | user agent клиента |
| `created_at` | `timestamptz` | время создания записи |

## Таблица `audit_events`

### Назначение

Неизменяемый журнал действий безопасности и администрирования.

### Поля

| Поле | Тип | Назначение |
| --- | --- | --- |
| `id` | `bigint` | монотонный идентификатор события |
| `actor_user_id` | `uuid` | кто совершил действие |
| `target_user_id` | `uuid` | к кому относится действие |
| `event_type` | `audit_event_type` | тип события |
| `payload` | `jsonb` | структурированный контекст |
| `created_at` | `timestamptz` | время события |

## Таблица `app_seed_runs`

### Назначение

Фиксирует, какие seed-паки уже были применены сервисом `db-init`.

### Поля

| Поле | Тип | Назначение |
| --- | --- | --- |
| `seed_key` | `text` | уникальный ключ seed-пакета |
| `checksum` | `text` | контрольная сумма содержимого |
| `payload` | `jsonb` | служебные детали применения |
| `applied_at` | `timestamptz` | время применения |

## Enums базы данных

### `user_status`

- `active`
- `inactive`
- `deleted`

### `refresh_revoke_reason`

- `logout`
- `logout_all`
- `password_changed`
- `admin_reset`
- `admin_delete`
- `rotation_replaced`
- `reuse_detected`

### `audit_event_type`

- `user_created`
- `user_updated`
- `user_deleted`
- `password_changed`
- `password_reset`
- `login_success`
- `login_failed`
- `logout`
- `logout_all`
- `refresh_rotated`
- `refresh_reuse_detected`

## Связанные документы

- [[../backend/02-Authentication-and-Tokens]]
- [[../backend/03-Users-and-Admin]]
- [[02-Constraints-Indexes-and-Checks]]
