---
tags:
  - docs
  - architecture
  - system
---

# System Architecture

## Домены системы

- `frontend workspace`
- `backend api`
- `research orchestrator`
- `document pipeline`
- `retrieval and evidence layer`
- `debate layer`
- `evaluation layer`
- `judge layer`
- `database`
- `document storage`

## Архитектурная схема

```mermaid
flowchart TD
    U[User] --> FE[Frontend workspace]
    FE --> API[FastAPI backend]
    API --> ORCH[Research orchestrator]
    API --> DB[(PostgreSQL)]
    API --> STORE[(Document storage)]
    ORCH --> DOC[Document pipeline]
    ORCH --> RET[Retrieval and evidence]
    ORCH --> HYP[Hypothesis engine]
    ORCH --> DEB[Debate layer]
    ORCH --> EVA[Evaluation layer]
    ORCH --> J[Judge]
    J --> DB
```

## Архитектурный принцип

Основная логика живёт в явном Python-оркестраторе. Агентные роли выполняются как управляемые шаги пайплайна с заданными prompt- и schema-контрактами. Количество стартовых гипотез и round limit debate loop задаются через pipeline settings, а не через разрозненные prompt-хаки.

## Системные модули

### Document pipeline

- ingestion;
- text extraction;
- chunking;
- metadata normalization.

### Retrieval and evidence

- semantic search;
- contradiction detection;
- claims and signals extraction;
- evidence pack assembly.

### Hypothesis engine

- generation of `3-5` initial hypotheses;
- mechanism framing;
- KPI alignment.

### Debate layer

- role sequencing per active hypothesis;
- round-limit enforcement;
- version release;
- transcript and argument map.

### Evaluation layer

- independent criteria scoring per refined hypothesis;
- ranking sheet assembly;
- structured evaluator outputs.

### Judge

- final synthesis across refined hypothesis set;
- prioritization;
- recommendation artifact.

## Контур данных

```mermaid
flowchart LR
    A[Source documents] --> B[Chunks and metadata]
    B --> C[Evidence items]
    C --> D[Initial hypothesis set]
    D --> E[Refined hypothesis versions]
    E --> F[Evaluator outputs and ranking]
    F --> G[Judge verdict]
```

## Связанные документы

- [[01-System-Overview]]
- [[03-Backend]]
- [[05-Data-and-Retrieval]]
