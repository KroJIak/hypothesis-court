---
tags:
  - docs
  - product
  - agents
---

# Agents and Judge

> [!important]
> Внутри debate loop все роли обсуждают одну и ту же гипотезу. В системе нет параллельных “альтернативных миров”, где каждая роль генерирует отдельную идею.

## Ролевой состав

### Debate layer

- `Defender`
- `Attacker`
- `Manufacturer`

### Evaluation layer

- `Finance`
- `Risk`
- дополнительные evaluators по критериям пользователя

### Final synthesis

- `Judge`

## Роли debate layer

### Defender

Роль:

- усиливает гипотезу;
- подтягивает supporting evidence;
- формулирует, почему гипотеза заслуживает дальнейшей проверки.

### Attacker

Роль:

- ищет противоречия;
- отмечает слабые места аргументации;
- отделяет правдоподобие от надёжной обоснованности;
- фиксирует неизвестные и хрупкие зоны.

### Manufacturer

Роль:

- проверяет технологическую реализуемость;
- соотносит гипотезу с производственными ограничениями;
- выбивает из гипотезы всё, что красиво звучит, но не переносится в практику.

## Логика debate loop

```mermaid
flowchart TD
    A[Hypothesis v1] --> B[Defender]
    B --> C[Attacker]
    C --> D[Manufacturer]
    D --> E[Hypothesis v2]
    E --> F{Refinement complete}
    F -- No --> B
    F -- Yes --> G[Final debated hypothesis]
```

## Evaluation layer

Evaluators работают независимо друг от друга.
Каждая роль смотрит на уже refined hypothesis и возвращает собственную structured assessment.

Примеры дополнительных evaluators:

- `Ecology`
- `Safety`
- `Scalability`
- `Patent Clearance`
- `Import Substitution`

## Judge

Judge собирает:

- итог debate loop;
- все evaluator outputs;
- ключевые evidence items;
- remaining risks.

Judge выпускает:

- verdict;
- приоритет;
- краткое executive summary;
- список сильных сторон;
- список слабых сторон;
- recommended next check.

## Стабильные правила платформы

> [!check]
> Эти правила определяют поведение агентной системы:

- custom evaluators живут в evaluation layer;
- debate layer отвечает за refinement гипотезы;
- evaluation layer отвечает за независимую оценку;
- judge синтезирует выводы и закрывает сессию verdict.

## Связанные документы

- [[03-Hypothesis-Pipeline]]
- [[05-Interface-and-Scene]]
- [[sources/hypothesis-factory/01-Full-Spec]]
