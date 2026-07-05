RESEARCH_JSON_SYSTEM_PROMPT = """
Ты backend-компонент R&D-платформы "Фабрика гипотез".
Отвечай только валидным JSON без Markdown, без комментариев и без текста вне JSON.
Все выводы должны быть проверяемыми, привязанными к evidence и полезными для исследователя.
Если данных недостаточно, явно фиксируй unknown/gap вместо выдумывания фактов.
""".strip()

EVIDENCE_EXTRACTION_PROMPT = """
Выдели evidence items из research brief и фрагментов источников.
Нужно найти факты, риски, ограничения, противоречия и неизвестные зоны.

JSON schema:
{
  "items": [
    {
      "source_index": 0,
      "kind": "support|contradiction|risk|constraint|unknown",
      "title": "короткий заголовок",
      "summary": "краткая интерпретация факта",
      "quote": "короткая цитата или null",
      "confidence": 0.0
    }
  ]
}
""".strip()

IMAGE_DESCRIPTION_PROMPT = """
Опиши изображение как источник для R&D-исследования.
Нужно извлечь максимум полезной информации для дальнейшего поиска evidence:
- весь читаемый текст, подписи, легенды, оси графиков и единицы измерения;
- таблицы и их значения;
- схемы, связи между элементами, последовательность процессов;
- численные параметры, материалы, режимы, условия эксперимента;
- выводы, риски, ограничения и неопределённости, которые видны на изображении.

Не выдумывай то, чего не видно. Если часть изображения нечитаема, явно напиши это.
Ответ дай обычным структурированным текстом на русском языке.
""".strip()

HYPOTHESIS_GENERATION_PROMPT = """
Сформируй стартовый набор из 3-5 исследовательских гипотез.
Каждая гипотеза должна быть проверяемой, связанной с KPI, иметь механизм влияния, практические риски и ссылки на evidence.

JSON schema:
{
  "hypotheses": [
    {
      "title": "название",
      "statement": "проверяемая формулировка",
      "mechanism": "механизм влияния",
      "kpi_alignment": "как связано с KPI",
      "feasibility": "реализуемость",
      "risk_profile": "ключевые риски",
      "novelty": "чем отличается от очевидного подхода",
      "evidence_links": [
        {"evidence_index": 0, "relation": "supports|contradicts|risk|constrains", "rationale": "почему связано"}
      ]
    }
  ]
}
""".strip()

DEBATE_PROMPT = """
Проведи один раунд debate по гипотезе.
Defender усиливает аргументацию, Attacker ищет слабые места, Manufacturer проверяет практическую реализуемость.
После реплик выпусти уточнённую версию гипотезы.

JSON schema:
{
  "messages": [
    {"role": "defender|attacker|manufacturer", "content": "реплика"}
  ],
  "refined_statement": "уточнённая формулировка",
  "change_summary": "что изменилось после критики"
}
""".strip()

EVALUATION_PROMPT = """
Оцени refined hypothesis с позиции указанного evaluator.
Оценка должна быть независимой, численной и объяснимой.

JSON schema:
{
  "score": 0.0,
  "verdict": "краткий вывод",
  "rationale": "обоснование оценки",
  "risk_notes": "условия, при которых оценка ухудшается"
}
""".strip()

JUDGE_PROMPT = """
Синтезируй финальный verdict judge по набору refined hypotheses, evidence и evaluator outputs.
Нужно сравнить гипотезы, назвать приоритет, сильные/слабые стороны, риск, ценность и первый шаг проверки.

JSON schema:
{
  "summary": "executive summary",
  "recommendation": "итоговая рекомендация",
  "ranking": [
    {"hypothesis_index": 0, "rank": 1, "priority": "high|medium|low", "reason": "почему такой приоритет"}
  ],
  "next_checks": ["первый эксперимент или проверка"]
}
""".strip()
