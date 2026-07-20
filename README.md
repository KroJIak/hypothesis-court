# Hypothesis Court

<p align="center">
  Платформа для исследовательских сессий, в которой KPI, ограничения и исходные материалы превращаются в набор гипотез, обсуждение, оценку и итоговую рекомендацию.
</p>

<p align="center">
  <img alt="FastAPI" src="https://img.shields.io/badge/backend-FastAPI-111111?style=flat-square">
  <img alt="React" src="https://img.shields.io/badge/frontend-React-111111?style=flat-square">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/database-PostgreSQL%20%2B%20pgvector-111111?style=flat-square">
  <img alt="Docker Compose" src="https://img.shields.io/badge/запуск-Docker%20Compose-111111?style=flat-square">
</p>

<p align="center">
  <img src="./docs/readme-assets/readme-workspace-overview.png" alt="Общий вид рабочей среды Hypothesis Court" width="100%">
</p>

<p align="center">
  Исследовательская сессия • Работа с фактами и ограничениями • Цикл обсуждения гипотез • Граф знаний • Итоговая оценка
</p>

<p align="center">
  <a href="#что-это">Что это</a> •
  <a href="#галерея">Галерея</a> •
  <a href="#сценарий-работы">Сценарий работы</a> •
  <a href="#архитектура">Архитектура</a> •
  <a href="#быстрый-запуск">Запуск</a>
</p>

<table>
  <tr>
    <td align="center"><strong>3-5</strong><br>стартовых гипотез</td>
    <td align="center"><strong>5</strong><br>слоев исследовательского контура</td>
    <td align="center"><strong>10+</strong><br>поддерживаемых форматов источников</td>
    <td align="center"><strong>1</strong><br>рабочая среда для фактов, обсуждения и вывода</td>
  </tr>
</table>

## Что это

**Hypothesis Court** — система для исследовательских и инженерных команд, которым нужно работать с задачей, источниками, гипотезами и итоговой оценкой в рамках одной сессии.

В проекте:

- пользователь формулирует `KPI`, ограничения и контекст;
- загружает документы, таблицы, PDF и изображения;
- получает набор фактов и ограничений, привязанный к источникам;
- видит стартовый набор из `3-5` гипотез;
- наблюдает цикл обсуждения по каждой гипотезе;
- получает независимую оценку, ранжирование и итоговый вывод;
- может открыть граф знаний и проследить путь от исходников до рекомендации.

Результат одной исследовательской сессии:

- постановка задачи;
- набор загруженных источников;
- набор фактов, рисков и ограничений;
- стартовый набор гипотез;
- версии гипотез после обсуждения;
- история обсуждения;
- результаты оценки;
- ранжирование вариантов;
- итоговая рекомендация.

## Что есть в проекте

<table>
  <tr>
    <td width="33%"><strong>Опора на источники</strong><br>Гипотезы связаны с конкретными фрагментами документов, а не только с итоговым текстом модели.</td>
    <td width="33%"><strong>Ролевое обсуждение</strong><br>Каждая гипотеза проходит через защиту, критику и проверку реализуемости.</td>
    <td width="33%"><strong>Прозрачность хода работы</strong><br>Пользователь видит не только итог, но и путь от вводных данных до ранжирования.</td>
  </tr>
  <tr>
    <td width="33%"><strong>Граф знаний</strong><br>Связывает вводные, файлы, факты, гипотезы, оценки и следующий шаг.</td>
    <td width="33%"><strong>Версии исследований</strong><br>Позволяет хранить и переключать версии исследования внутри одной сессии.</td>
    <td width="33%"><strong>Управление настройками</strong><br>Позволяет настраивать пользователей, текстовый провайдер и провайдер эмбеддингов через интерфейс.</td>
  </tr>
</table>

## Галерея

<table>
  <tr>
    <td colspan="2">
      <img src="./docs/readme-assets/readme-workspace-overview.png" alt="Общий вид рабочей среды" width="100%">
    </td>
  </tr>
  <tr>
    <td colspan="2" align="center">Общий вид рабочей среды: карточки гипотез, сцена, итоговый вывод, ранжирование и обработанные вложения</td>
  </tr>
  <tr>
    <td>
      <img src="./docs/readme-assets/readme-debate-history.png" alt="История сообщений защитника, атакующего и производственника" width="100%">
    </td>
    <td>
      <img src="./docs/readme-assets/readme-agent-setup.png" alt="Настройка дополнительного агента" width="100%">
    </td>
  </tr>
  <tr>
    <td align="center">История обсуждения по гипотезе: защитник, атакующий и производственник с разбором по циклам</td>
    <td align="center">Создание дополнительного агента в черновике версии: имя, иконка и системный промпт</td>
  </tr>
  <tr>
    <td>
      <img src="./docs/readme-assets/readme-hypothesis-preview.png" alt="Предпросмотр гипотезы" width="100%">
    </td>
    <td>
      <img src="./docs/readme-assets/readme-knowledge-graph.png" alt="Граф знаний" width="100%">
    </td>
  </tr>
  <tr>
    <td align="center">Предпросмотр гипотезы с кратким механизмом, связью с KPI и оценкой реализуемости</td>
    <td align="center">Граф знаний: вводные, источники, факты, гипотезы и итоговый вывод в одной схеме</td>
  </tr>
</table>

## Сценарий работы

Поддерживаются текстовые и табличные файлы `txt`, `md`, `csv`, `json`, `xml`, `html`, `pdf`, `docx`, `xlsx`, а также изображения `bmp`, `jpeg`, `jpg`, `png`, `tif`, `tiff`, `webp`. Для изображений используется либо модель с поддержкой анализа картинок, либо `Tesseract OCR (rus+eng)`.

1. Формулирует задачу через `KPI`, ограничения и контекст.
2. Загружает документы и вспомогательные материалы.
3. Дожидается обработки и индексации файлов.
4. Получает факты, риски и ограничения с привязкой к исходным материалам.
5. Смотрит стартовый набор гипотез.
6. Наблюдает внутреннюю критику и доработку гипотез.
7. Изучает результаты оценки и рейтинг.
8. Получает финальную рекомендацию и список первых проверок.

## Архитектура

```mermaid
flowchart TD
    U[Браузер] --> N[nginx]
    N --> FE[React-интерфейс]
    N --> API[FastAPI API]
    API --> DB[(PostgreSQL + pgvector)]
    API --> STORE[(Хранилище файлов)]
    DBI[db-init] --> DB
    API --> ORCH[Исследовательский оркестратор]
    ORCH --> DOC[Обработка документов]
    ORCH --> RET[Поиск и факты]
    ORCH --> HYP[Построение гипотез]
    ORCH --> DEB[Обсуждение]
    ORCH --> EVA[Оценка]
    ORCH --> J[Судья]
```

В состав локального контура входят:

- `frontend`
- `backend`
- `postgres`
- `db-init`
- `nginx`

Архитектурный принцип:

- `frontend` отвечает за интерфейс исследовательской среды, сцену и граф знаний;
- `backend` держит API, оркестрацию, состояние сессий и экспорт результатов;
- `исследовательский оркестратор` явно проводит этапы обработки документов, поиска, построения гипотез, обсуждения, оценки и итогового вывода;
- `postgres + pgvector` хранят пользователей, состояние сессий, фрагменты документов, факты и версии исследований.

## Быстрый запуск

```bash
git clone https://github.com/KroJIak/hypothesis-court.git
cd hypothesis-court
cp .env.example .env
docker compose up --build
```

После старта:

- приложение: `http://localhost:18080`
- документация API: `http://localhost:18080/api/docs`

Если вы изменили `NGINX_EXTERNAL_PORT`, открывайте свой порт из `.env`.

Самый короткий путь локально:

1. Заполнить `.env`.
2. Поднять `docker compose up --build`.
3. Войти под `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`.
4. Загрузить материалы и запустить исследовательскую сессию.

## Минимальная конфигурация `.env`

Заполняйте `.env` на основе `.env.example`. Минимально важные переменные:

```env
POSTGRES_DB=...
POSTGRES_USER=...
POSTGRES_PASSWORD=...

AUTH_JWT_SECRET=...

SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=...

MODEL_PROVIDER_BASE_URL=...
MODEL_PROVIDER_API_KEY=...
MODEL_PROVIDER_MODEL=...
MODEL_PROVIDER_API_MODE=chat_completions
MODEL_PROVIDER_FOLDER_ID=

EMBEDDING_BASE_URL=...
EMBEDDING_API_KEY=...
EMBEDDING_MODEL=...
EMBEDDING_FOLDER_ID=
```

Важно:

- `MODEL_PROVIDER_*` нужны для построения гипотез, обсуждения, оценки и итогового вывода.
- `EMBEDDING_*` нужны для обработки документов, поиска и слоя фактов.
- для OpenAI-совместимых провайдеров `*_FOLDER_ID` обычно можно оставить пустым.
- настройки провайдеров можно менять и после входа через панель администратора.

## Структура репозитория

```text
backend/   FastAPI API, оркестрация, модели, сервисы, Alembic
frontend/  React-интерфейс, авторизация, сцена, граф, логика интерфейса
nginx/     внешний вход и маршрутизация трафика
docs/      продуктовая и архитектурная документация, внутренние примеры, исходные материалы
```

## Карта документации

- [docs/01-Project-Scope.md](./docs/01-Project-Scope.md)
- [docs/02-Product-Model.md](./docs/02-Product-Model.md)
- [docs/product/03-Hypothesis-Pipeline.md](./docs/product/03-Hypothesis-Pipeline.md)
- [docs/product/06-Session-Walkthrough.md](./docs/product/06-Session-Walkthrough.md)
- [docs/architecture/01-System-Overview.md](./docs/architecture/01-System-Overview.md)
- [docs/architecture/02-System-Architecture.md](./docs/architecture/02-System-Architecture.md)
- [docs/architecture/06-Infrastructure.md](./docs/architecture/06-Infrastructure.md)

## Частые проблемы

### Не открывается приложение

- проверьте `docker compose ps`
- проверьте, какой `NGINX_EXTERNAL_PORT` стоит в `.env`

### Исследовательский пайплайн не стартует

- проверьте `MODEL_PROVIDER_BASE_URL`
- проверьте `MODEL_PROVIDER_API_KEY`
- проверьте `MODEL_PROVIDER_MODEL`

### Файлы загружаются, но факты не строятся

- проверьте `EMBEDDING_BASE_URL`
- проверьте `EMBEDDING_API_KEY`
- проверьте `EMBEDDING_MODEL`

### После изменения `.env` ничего не меняется

```bash
docker compose down
docker compose up --build
```

## Контекст разработки

Проект был сделан в рамках хакатона [НОРНИКЕЛЬ AI SCIENCE HACK 2026](https://nornickel-ai-hackathon.ru/).

Команда работала над задачей `Фабрика гипотез`.
