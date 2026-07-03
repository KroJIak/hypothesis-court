---
tags:
  - docs
  - architecture
  - database
  - constraints
---

# Ограничения, Индексы И Проверки

## Naming convention

Для единообразия используются имена:

- `pk_*` — primary keys
- `fk_*` — foreign keys
- `uq_*` — unique constraints
- `ck_*` — check constraints
- `ix_*` — indexes

## Ограничения таблицы `users`

### Primary and unique

- `pk_users`
- `uq_users__username`

### Checks

- `ck_users__username_trimmed`
- `ck_users__username_length`
- `ck_users__first_name_trimmed`
- `ck_users__last_name_trimmed`
- `ck_users__token_version_positive`
- `ck_users__superadmin_implies_admin`
- `ck_users__deleted_status_consistency`
- `ck_users__deleted_actor_consistency`

### Смысл проверок

- логин не может храниться с пробелами по краям;
- логин обязан иметь длину `3..64`;
- имя и фамилия либо `null`, либо непустые trimmed-значения;
- `token_version >= 1`;
- суперпользователь всегда является администратором;
- статус `deleted` обязан сопровождаться `deleted_at`;
- `deleted_by_user_id` нельзя заполнять без факта удаления.

## Ограничения таблицы `auth_refresh_sessions`

### Primary and unique

- `pk_auth_refresh_sessions`
- `uq_auth_refresh_sessions__refresh_token_hash`

### Foreign keys

- `fk_auth_refresh_sessions__user_id__users`
- `fk_auth_refresh_sessions__parent_session_id__auth_refresh_sessions`
- `fk_auth_refresh_sessions__replaced_by_session_id__auth_refresh_sessions`

### Checks

- `ck_auth_refresh_sessions__expiry_after_issue`
- `ck_auth_refresh_sessions__revocation_reason_consistency`
- `ck_auth_refresh_sessions__parent_not_self`
- `ck_auth_refresh_sessions__replacement_not_self`

### Смысл проверок

- `expires_at` всегда позже `issued_at`;
- если `revoked_at` заполнен, причина отзыва обязательна;
- сессия не может ссылаться на саму себя как на parent или replacement.

## Ограничения таблицы `audit_events`

- `pk_audit_events`
- `fk_audit_events__actor_user_id__users`
- `fk_audit_events__target_user_id__users`
- `ck_audit_events__payload_is_object`

`payload` хранится только как JSON-object, а не массив или произвольный scalar.

## Ограничения таблицы `app_seed_runs`

- `pk_app_seed_runs`
- `ck_app_seed_runs__seed_key_not_blank`

## Основные индексы

### `users`

- `ix_users__status`
- `ix_users__is_admin`
- `ix_users__created_at`

`username` уже покрыт unique constraint и является главным lookup для login.

### `auth_refresh_sessions`

- `ix_auth_refresh_sessions__user_id`
- `ix_auth_refresh_sessions__family_id`
- `ix_auth_refresh_sessions__parent_session_id`
- `ix_auth_refresh_sessions__replaced_by_session_id`
- `ix_auth_refresh_sessions__user_active`
- `ix_auth_refresh_sessions__expires_at`

`ix_auth_refresh_sessions__user_active` делается partial-index по активным, ещё не отозванным сессиям:

```text
(user_id, expires_at desc) where revoked_at is null
```

Это ускоряет:

- `logout-all`;
- выдачу списка активных сессий;
- массовый отзыв при смене пароля.

### `audit_events`

- `ix_audit_events__actor_user_id__created_at`
- `ix_audit_events__target_user_id__created_at`
- `ix_audit_events__event_type__created_at`

### `app_seed_runs`

Дополнительные индексы не требуются: таблица маленькая и читается по `seed_key`.

## Оптимизация и практические правила

### Case-insensitive login

`citext` позволяет не дублировать lower-case колонку и не усложнять login-поиск.

### Soft delete вместо hard delete

Логическое удаление сохраняет:

- историю создания и удаления пользователей;
- целостность audit trail;
- запрет на повторное использование старого логина.

### Hash вместо хранения refresh token

Если БД будет скомпрометирована, злоумышленник не получит готовые refresh token в открытом виде.

### Неизменяемый аудит

`audit_events` не обновляется и не переписывается, поэтому остаётся предсказуемой и дешёвой для записи.

### Проверка `token_version`

Каждый защищённый запрос после декодирования JWT сверяет `token_version` из токена с актуальным значением пользователя в БД.
Это делает мгновенный глобальный logout технически простым и надёжным.

### Транзакции refresh rotation

Ротация refresh token выполняется под блокировкой конкретной session row, чтобы две параллельные попытки refresh не выпустили две валидные ветки одной и той же цепочки.

## Связанные документы

- [[01-Identity-and-Auth-Schema]]
- [[../backend/02-Authentication-and-Tokens]]
- [[../backend/04-Db-Init-and-Seeds]]
