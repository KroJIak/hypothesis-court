---
tags:
  - docs
  - architecture
  - backend
  - users
---

# Пользователи И Администрирование

## Пользовательская модель

В системе существуют только внутренние учётные записи. Публичной регистрации нет.
Пользователь может быть:

- обычным пользователем;
- администратором;
- суперпользователем.

## Bootstrap superadmin

Первый суперпользователь создаётся через `db-init` на основании `.env`.

### Обязательные env-поля

- `SUPERADMIN_USERNAME`
- `SUPERADMIN_PASSWORD`

### Необязательные env-поля

- `SUPERADMIN_FIRST_NAME`
- `SUPERADMIN_LAST_NAME`

### Жёсткие правила суперпользователя

- `is_superadmin = true`
- `is_admin = true`
- не удаляется через админ-панель;
- не переводится в не-админский режим;
- если запись уже существует, `db-init` обновляет служебные поля и пароль по правилам bootstrap-режима.

## Пользовательские поля

### Обязательные

- `username`
- `password`

### Необязательные

- `first_name`
- `last_name`

## Административные операции

### `POST /users`

Администратор создаёт нового пользователя и сразу задаёт:

- `username`
- `password`
- `is_admin`
- `first_name`
- `last_name`

Пользователь создаётся в статусе `active`, если операция прошла успешно.

### `GET /users`

Администратор получает список пользователей для панели управления.
Список поддерживает:

- поиск по `username`;
- фильтр по `is_admin`;
- фильтр по `status`;
- сортировку по `created_at` или `username`.

### `PATCH /users/{user_id}`

Администратор может менять:

- `first_name`
- `last_name`
- `is_admin`
- `status`

### `POST /users/{user_id}/reset-password`

Администратор сам указывает новый пароль.
Старый пароль знать не требуется.
После reset:

- старый password hash заменяется;
- все refresh sessions пользователя отзываются;
- `token_version` увеличивается;
- пользователь должен войти заново.

### `DELETE /users/{user_id}`

Удаление для интерфейса выглядит как delete, но на уровне хранения это logical delete.

Результат операции:

- `status = deleted`
- `deleted_at` заполняется
- `deleted_by_user_id` заполняется
- все refresh sessions пользователя отзываются
- логин остаётся зарезервированным и не переиспользуется

## Самообслуживание пользователя

### `GET /users/me`

Возвращает текущего пользователя по access token.

### `PATCH /users/me/profile`

Пользователь может поменять только:

- `first_name`
- `last_name`

### `POST /users/me/change-password`

Пользователь передаёт:

- `old_password`
- `new_password`
- `new_password_repeat`

Пароль меняется только если:

- старый пароль совпал;
- новый и повтор нового совпадают;
- новый пароль прошёл policy validation.

После смены пароля пользователь выходит из всех сессий и выполняет новый login.

## Валидация

- `username` хранится в trimmed-виде;
- длина `username` ограничена диапазоном `3..64`;
- `first_name` и `last_name` необязательны, но если переданы, не могут быть пустой строкой;
- пароль хранится только как Argon2id hash;
- удалённый пользователь не может пройти login или refresh.

## Аудит операций

Каждое действие, меняющее доступ или учётную запись, пишет запись в `audit_events`.

Базовые события:

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

- [[02-Authentication-and-Tokens]]
- [[04-Db-Init-and-Seeds]]
- [[../database/01-Identity-and-Auth-Schema]]
