---
tags:
  - docs
  - index
  - obsidian
---

# Hypothesis Court

> [!abstract]
> Эта папка фиксирует, **что именно мы строим**, **что уже есть в репозитории** и **какие решения уже приняты** по продукту и архитектуре.

## Как читать

1. [[01-Project-Scope]]
2. [[02-MVP-and-Target-Product]]
3. [[03-Roadmap]]
4. [[product/00-INDEX]]
5. [[architecture/00-INDEX]]
6. [[sources/00-INDEX]]

## Карта документации

```text
docs/
├── 00-INDEX.md
├── 01-Project-Scope.md
├── 02-MVP-and-Target-Product.md
├── 03-Roadmap.md
├── product/
│   ├── 00-INDEX.md
│   ├── 01-Problem-and-Value.md
│   ├── 02-User-Flow.md
│   ├── 03-Hypothesis-Pipeline.md
│   ├── 04-Agents-and-Judge.md
│   └── 05-Interface-and-Scene.md
├── architecture/
│   ├── 00-INDEX.md
│   ├── 01-Current-State.md
│   ├── 02-Target-System.md
│   ├── 03-Backend.md
│   ├── 04-Frontend.md
│   ├── 05-Data-and-Retrieval.md
│   └── 06-Infrastructure.md
└── sources/
    ├── 00-INDEX.md
    ├── 01-Hypothesis-Factory-Source.md
    └── 02-Chat-Decisions.md
```

## Основные принципы

> [!important]
> В этой документации жёстко разделены:
> - **целевой продукт**
> - **текущее состояние репозитория**
> - **исходные материалы**

> [!note]
> Файл [[sources/01-Hypothesis-Factory-Source]] сохранён как буквальная копия организаторского описания. Он не очищался и не перефразировался.

## Быстрые переходы

- [[product/03-Hypothesis-Pipeline|Целевой пайплайн генерации и оценки гипотез]]
- [[product/04-Agents-and-Judge|Каноническая агентная схема]]
- [[product/05-Interface-and-Scene|Целевой интерфейс и сцена спора]]
- [[architecture/01-Current-State|Что реально уже реализовано]]
- [[architecture/05-Data-and-Retrieval|Как должны работать данные, RAG и evidence layer]]
- [[sources/02-Chat-Decisions|Решения, уже зафиксированные в истории обсуждения]]
