---
tags:
  - docs
  - index
  - obsidian
---

# Hypothesis Court

> [!abstract]
> Эта документация описывает **Hypothesis Court** как действующую платформу для генерации, обсуждения и приоритизации исследовательских гипотез.

## Как читать

1. [[01-Project-Scope]]
2. [[02-Product-Model]]
3. [[product/00-INDEX]]
4. [[architecture/00-INDEX]]
5. [[sources/00-INDEX]]

## Карта документации

```text
docs/
├── 00-INDEX.md
├── 01-Project-Scope.md
├── 02-Product-Model.md
├── product/
│   ├── 00-INDEX.md
│   ├── 01-Problem-and-Value.md
│   ├── 02-User-Flow.md
│   ├── 03-Hypothesis-Pipeline.md
│   ├── 04-Agents-and-Judge.md
│   ├── 05-Interface-and-Scene.md
│   └── 06-Session-Walkthrough.md
├── architecture/
│   ├── 00-INDEX.md
│   ├── 01-System-Overview.md
│   ├── 02-System-Architecture.md
│   ├── 03-Backend.md
│   ├── backend/
│   │   ├── 00-INDEX.md
│   │   ├── 01-Backend-Overview.md
│   │   ├── 02-Authentication-and-Tokens.md
│   │   ├── 03-Users-and-Admin.md
│   │   └── 04-Db-Init-and-Seeds.md
│   ├── database/
│   │   ├── 00-INDEX.md
│   │   ├── 01-Identity-and-Auth-Schema.md
│   │   └── 02-Constraints-Indexes-and-Checks.md
│   ├── 04-Frontend.md
│   ├── 05-Data-and-Retrieval.md
│   └── 06-Infrastructure.md
├── internal/
│   └── Tailings-Example/
└── sources/
    ├── 00-INDEX.md
    └── Organizer-Materials/
        ├── 00-INDEX.md
        ├── Hypothesis-Factory/
        └── Yandex-AI-Studio-API-Access.md
```

## Документационные слои

> [!important]
> Документация разделена на три слоя:
> - **product**: пользовательская логика, исследовательский поток и UX
> - **architecture**: техническое устройство платформы
> - **sources**: исходные материалы и зафиксированные решения

## Быстрые переходы

- [[02-Product-Model|Операционная модель продукта]]
- [[product/03-Hypothesis-Pipeline|Пайплайн гипотез]]
- [[product/04-Agents-and-Judge|Агентная схема и судья]]
- [[architecture/01-System-Overview|Системный обзор]]
- [[architecture/backend/02-Authentication-and-Tokens|Аутентификация и токены]]
- [[architecture/database/01-Identity-and-Auth-Schema|Схема identity и auth]]
- [[architecture/05-Data-and-Retrieval|Данные, retrieval и evidence layer]]

## Навигационный принцип

> [!note]
> Основной слой для повседневной работы команды начинается с `product/` и `architecture/`.
> `sources/` хранит первоисточники и decision log для сверки формулировок и контекста.
