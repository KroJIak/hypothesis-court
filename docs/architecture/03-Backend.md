---
tags:
  - docs
  - architecture
  - backend
---

# Backend

## Роль backend

Backend выступает как API- и orchestration-layer платформы. Он управляет жизненным циклом research session, хранит артефакты гипотез и публикует состояние системы для frontend.

## Основные зоны ответственности

- intake исследовательской задачи;
- загрузка и регистрация документов;
- запуск hypothesis pipeline;
- хранение evidence, initial hypothesis set, hypothesis versions, ranking и verdict;
- фиксация pipeline settings snapshot для каждого запуска;
- выдача структурированных данных в workspace UI.

## Логическая структура

```text
backend/app/
├── api/            - routes, request/response contracts
├── core/           - settings and cross-cutting config
├── schemas/        - typed payloads
├── services/       - application services
├── orchestrators/  - multi-step research flows
├── repositories/   - persistence access
├── models/         - domain entities
└── workers/        - long-running or async jobs
```

## Domain entities

- `research_session`
- `source_document`
- `document_chunk`
- `evidence_item`
- `hypothesis_set`
- `hypothesis`
- `debate_round`
- `evaluation_result`
- `ranking_result`
- `pipeline_config_snapshot`
- `judge_verdict`

## Endpoint groups

- `health`
- `research sessions`
- `documents`
- `evidence`
- `hypotheses`
- `debates`
- `evaluations`
- `rankings`
- `verdicts`
- `pipeline settings`

## Прикладной поток

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as FastAPI
    participant ORCH as Orchestrator
    participant DATA as Data Layer
    participant AI as Debate/Evaluation Layers

    UI->>API: create session
    UI->>API: upload sources
    UI->>API: run analysis
    API->>ORCH: start pipeline
    ORCH->>DATA: build evidence pack
    ORCH->>AI: generate initial hypothesis set
    AI-->>ORCH: 3-5 initial hypotheses
    ORCH->>AI: run debate per hypothesis
    AI-->>ORCH: refined hypothesis set
    ORCH->>AI: run evaluators and ranking
    AI-->>ORCH: scores + ranking
    ORCH-->>API: final verdict
    API-->>UI: session state and outputs
```

## Правила backend-слоя

- HTTP-контракты остаются тонкими и typed.
- Оркестрация живёт отдельно от transport layer.
- LLM outputs нормализуются схемами.
- Pipeline settings сохраняются вместе с session run.
- Все исследовательские артефакты сохраняются как session state.

## Связанные документы

- [[02-System-Architecture]]
- [[05-Data-and-Retrieval]]
- [[product/03-Hypothesis-Pipeline]]
