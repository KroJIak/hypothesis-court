---
tags:
  - docs
  - product
  - pipeline
---

# Hypothesis Pipeline

> [!abstract]
> Hypothesis pipeline связывает knowledge ingestion, retrieval, debate and evaluation в один объяснимый контур.

## Верхнеуровневая схема

```mermaid
flowchart TD
    A[Input: KPI, constraints, sources] --> B[Ingestion]
    B --> C[Retrieval]
    C --> D[Evidence layer]
    D --> E[Initial hypothesis]
    E --> F[Debate loop]
    F --> G[Evaluation layer]
    G --> H[Judge synthesis]
    H --> I[Recommendation]
```

## Этап 1. Ingestion

Система принимает:

- научные статьи;
- внутренние отчёты;
- результаты экспериментов;
- служебные заметки;
- KPI и ограничения.

Результат:

- документы нормализованы;
- метаданные сохранены;
- контент подготовлен к search и citation.

## Этап 2. Retrieval

Система поднимает:

- релевантные факты;
- сигналы пользы и риска;
- исторические удачи и провалы;
- противоречия между источниками;
- участки, где данных недостаточно.

Результат:

- evidence pack, привязанный к конкретной сессии.

## Этап 3. Initial hypothesis

Hypothesis engine формирует рабочую гипотезу, которая:

- связана с KPI;
- проверяема;
- содержит механизм влияния;
- опирается на evidence;
- учитывает ограничения.

## Этап 4. Debate loop

Одна гипотеза проходит цикл:

1. `Defender` усиливает и формулирует сильные стороны.
2. `Attacker` вскрывает логические и доказательные слабости.
3. `Manufacturer` проверяет реализуемость в реальных условиях.
4. Система выпускает новую версию гипотезы.
5. Цикл повторяется до завершения refinement.

Результат:

- refined hypothesis;
- history of changes;
- debate transcript;
- argument map.

## Этап 5. Evaluation layer

После debate hypothesis оценивается независимо:

- `Finance`
- `Risk`
- дополнительные evaluators по критериям пользователя

Каждый evaluator возвращает:

- краткий вывод;
- оценку по своему критерию;
- ключевые факторы;
- замечания и boundary conditions.

## Этап 6. Judge synthesis

Judge агрегирует:

- финальную debated version;
- outputs evaluators;
- evidence highlights;
- unresolved risks.

Judge verdict содержит:

- приоритет гипотезы;
- сильные стороны;
- слабые стороны;
- уровень риска;
- ожидаемую ценность;
- рекомендованный первый эксперимент или первый шаг проверки.

## Артефакты пайплайна

- `research_brief`
- `evidence_pack`
- `hypothesis_v1`
- `hypothesis_v2..vN`
- `debate_transcript`
- `evaluation_sheet`
- `final_recommendation`

## Связанные документы

- [[04-Agents-and-Judge]]
- [[architecture/03-Backend]]
- [[architecture/05-Data-and-Retrieval]]
