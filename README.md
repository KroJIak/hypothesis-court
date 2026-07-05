# Hypothesis Court

## НЕ ЗАБУДЬТЕ НАСТРОИТЬ .ENV ИЗ .ENV.EXAMPLE

Hypothesis Court - сервис для загрузки источников, генерации гипотез, дебатов агентов, экспертной оценки и финальной рекомендации.

## Быстрый запуск с нуля

Нужны:

- `Git`
- `Docker`
- `Docker Compose`

1. Склонируйте проект и перейдите в папку:

```bash
git clone <repository-url>
cd hypothesis-court
```

2. Создайте `.env` из примера:

```bash
cp .env.example .env
```

Для Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Откройте `.env` и обязательно заполните значения.

Минимально проверьте:

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
MODEL_PROVIDER_FOLDER_ID=

EMBEDDING_BASE_URL=...
EMBEDDING_API_KEY=...
EMBEDDING_MODEL=...
EMBEDDING_FOLDER_ID=
```

Важно:

- `MODEL_PROVIDER_BASE_URL`, `MODEL_PROVIDER_API_KEY`, `MODEL_PROVIDER_MODEL` нужны для генерации гипотез, дебатов, оценок, вердикта и промптов агентов.
- `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL` нужны для обработки документов и поиска по источникам.
- Если используете Yandex AI Studio, укажите `MODEL_PROVIDER_FOLDER_ID` и/или `EMBEDDING_FOLDER_ID`, если это требуется вашим способом подключения.
- Для OpenAI-compatible провайдеров `*_FOLDER_ID` обычно можно оставить пустым.
- Настройки провайдера также можно изменить после входа на сайт в админ-панели.

4. Запустите сервис:

```bash
docker compose up --build
```

5. Откройте сайт:

```text
http://localhost:8080
```

Если порт изменен в `.env`, используйте значение `NGINX_EXTERNAL_PORT`.

## Вход в систему

Логин суперадмина задается в `.env`:

```env
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=your_superadmin_password
```

Пароль суперадмина можно посмотреть:

- в `.env` в переменной `SUPERADMIN_PASSWORD`;
- на странице логина, если данные суперадмина выведены там для организаторов.

После входа суперадмин может открыть админ-панель и настроить пользователей, LLM-провайдера и embedding-провайдера.

## Полезные команды

Запустить сервис:

```bash
docker compose up --build
```

Запустить в фоне:

```bash
docker compose up --build -d
```

Остановить сервис:

```bash
docker compose down
```

Посмотреть логи:

```bash
docker compose logs -f
```

Перезапустить после изменения `.env`:

```bash
docker compose down
docker compose up --build
```

Полностью пересоздать базу и файлы загрузок:

```bash
docker compose down -v
docker compose up --build
```

Осторожно: команда `docker compose down -v` удаляет данные PostgreSQL и загруженные файлы.

## Частые ошибки

### Не открывается сайт

Проверьте, что контейнеры запущены:

```bash
docker compose ps
```

Проверьте адрес:

```text
http://localhost:8080
```

Если в `.env` указан другой `NGINX_EXTERNAL_PORT`, откройте этот порт.

### Порт уже занят

Измените порт в `.env`:

```env
NGINX_EXTERNAL_PORT=8081
```

Затем перезапустите:

```bash
docker compose down
docker compose up --build
```

### Ошибка `Missing required environment variable`

В `.env` не заполнена обязательная переменная. Чаще всего забывают:

- `MODEL_PROVIDER_BASE_URL`
- `MODEL_PROVIDER_MODEL`
- `EMBEDDING_BASE_URL`
- `EMBEDDING_MODEL`
- `AUTH_JWT_SECRET`

Сверьте `.env` с `.env.example`.

### Не работает генерация гипотез или ответов агентов

Проверьте настройки LLM:

```env
MODEL_PROVIDER_BASE_URL=...
MODEL_PROVIDER_API_KEY=...
MODEL_PROVIDER_MODEL=...
MODEL_PROVIDER_API_MODE=chat_completions
```

Если используете Yandex AI Studio, проверьте `MODEL_PROVIDER_FOLDER_ID`.

Также настройки можно проверить и обновить в админ-панели на сайте.

### Файлы загружаются, но поиск по ним не работает

Проверьте embedding-настройки:

```env
EMBEDDING_BASE_URL=...
EMBEDDING_API_KEY=...
EMBEDDING_MODEL=...
EMBEDDING_FOLDER_ID=
```

Если используете Yandex AI Studio, проверьте `EMBEDDING_FOLDER_ID`.

### Не подходит пароль суперадмина

Проверьте `SUPERADMIN_USERNAME` и `SUPERADMIN_PASSWORD` в `.env`.

Если база уже была создана со старым паролем, перезапустите init-контейнер или пересоздайте данные:

```bash
docker compose down -v
docker compose up --build
```

Осторожно: это удалит текущую базу и загруженные файлы.

### После изменения `.env` ничего не поменялось

Перезапустите контейнеры:

```bash
docker compose down
docker compose up --build
```

### Нужна помощь

Если не получается поднять сервис или ошибка непонятна, напишите в Telegram: `@krojiak`.
