---
tags:
  - docs
  - architecture
  - backend
---

# Backend: Детализация

> [!abstract]
> Этот раздел фиксирует рабочий backend-контур платформы: прикладной слой FastAPI, identity и access, управление пользователями и сервис инициализации базы данных.

## Содержание

1. [[01-Backend-Overview]]
2. [[02-Authentication-and-Tokens]]
3. [[03-Users-and-Admin]]
4. [[04-Db-Init-and-Seeds]]

## Логика чтения

- [[01-Backend-Overview]] даёт карту backend-пакетов и границ ответственности.
- [[02-Authentication-and-Tokens]] описывает login, refresh, logout и политику токенов.
- [[03-Users-and-Admin]] фиксирует пользовательский CRUD и административные ограничения.
- [[04-Db-Init-and-Seeds]] описывает запуск миграций, bootstrap суперпользователя и seed-паки.

## Соседние разделы

- [[../03-Backend]]
- [[../database/00-INDEX]]
- [[../06-Infrastructure]]
