---
tags:
  - docs
  - sources
  - api
---

# Yandex AI Studio API Access

> [!note]
> Эта инструкция описывает, как использовать доступ к Yandex AI Studio через API.

## Что есть у команды

Для работы используются данные из письма от организаторов:

- `API Key`
- `folder_id`

## Что нужно использовать

Используется API-часть quickstart guide:

https://aistudio.yandex.ru/docs/ru/ai-studio/quickstart/index.html

## Как работать с доступом

1. Откройте quickstart guide.
2. Перейдите к части, связанной с API.
3. Возьмите из письма:
   - `API Key`
   - `folder_id`
4. Используйте их в коде при создании клиента.

## Python setup

- Использовать Python `3.10` или выше.
- При необходимости создать виртуальное окружение:

```bash
python3 -m venv new-env
source new-env/bin/activate
```

- Установить библиотеку:

```bash
pip install --upgrade openai
```

## Пример настройки клиента

```python
import openai

YANDEX_FOLDER_ID = "<folder_id>"
YANDEX_API_KEY = "<api_key>"

client = openai.OpenAI(
    api_key=YANDEX_API_KEY,
    project=YANDEX_FOLDER_ID,
    base_url="https://ai.api.cloud.yandex.net/v1",
)
```

## Пример запроса к модели

```python
YANDEX_MODEL = "aliceai-llm"

response = client.responses.create(
    model=f"gpt://{YANDEX_FOLDER_ID}/{YANDEX_MODEL}",
    input="Придумай 3 необычные идеи для стартапа в сфере путешествий.",
    temperature=0.8,
    max_output_tokens=1500,
)

print(response.output[0].content[0].text)
```

## Практический смысл

- доступ выдан именно к API;
- `folder_id` и `API Key` подставляются в код;
- основной сценарий работы идёт через запросы к модели, а не через ручную настройку в интерфейсе.
