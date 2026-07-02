---
tags:
  - docs
  - architecture
  - frontend
---

# Фронтенд

## Роль frontend

Frontend должен не просто отправлять prompt и показывать ответ. Он должен визуализировать:

- постановку исследовательской задачи;
- ход поиска и отбора evidence;
- эволюцию гипотезы;
- сцену debate loop;
- независимую оценку;
- финальный verdict.

## Что есть сейчас

Текущий frontend уже содержит удачный UI-прототип:

- sidebar с сессиями;
- debate stage;
- evaluation stage;
- agent palette;
- composer;
- вложения.

Эта логика собрана в `frontend/src/features/workspace`.

## Что отсутствует сейчас

- реальный API client под продуктовые endpoints;
- состояние живой исследовательской сессии;
- загрузка файлов;
- поток обновлений пайплайна;
- отображение evidence и цитат;
- история версий гипотезы;
- экраны ошибок и пустых состояний под реальные сценарии.

## Предпочтительная структура frontend-домена

```text
frontend/src/
├── app/
├── shared/
├── features/
│   ├── research-session/
│   ├── document-upload/
│   ├── evidence-viewer/
│   ├── debate-scene/
│   ├── evaluation-panel/
│   └── final-verdict/
└── pages/
```

## Основные UI-состояния

- `idle` — задача ещё не поставлена;
- `collecting-input` — пользователь задаёт KPI и прикладывает материалы;
- `processing` — пайплайн запущен;
- `debating` — идёт спор ролей;
- `evaluating` — считаются независимые критерии;
- `completed` — verdict готов;
- `failed` — ошибка пайплайна или недостающие данные.

## Принципы UI

> [!important]
> Интерфейс должен выглядеть как продукт с характером, а не как стандартная админка или generic AI dashboard.

- Центральная сцена должна быть главным фокусом.
- Источники и evidence должны быть доступны рядом, а не спрятаны.
- Пользователь должен видеть, какая версия гипотезы текущая.
- Разница между debate и evaluation должна быть очевидна визуально.

## Связь с backend

### Через docker compose

- frontend ходит в API через `/api`;
- nginx маршрутизирует запросы.

### При локальном запуске frontend

- frontend использует локальный env-файл;
- `VITE_API_BASE_URL` может указывать напрямую на backend.

## Связанные документы

- [[01-Current-State]]
- [[06-Infrastructure]]
- [[product/05-Interface-and-Scene]]
