const API_ERROR_TRANSLATIONS = new Map([
  ["Admin access required.", "Нужны права администратора"],
  ["Admins can manage regular users only.", "Администратор может управлять только обычными пользователями"],
  ["Agent is already selected in this chat.", "Этот агент уже добавлен в чат"],
  ["Agent name cannot be empty.", "Название агента не может быть пустым"],
  ["Agent name must contain at most 100 characters.", "Название агента должно быть не длиннее 100 символов"],
  ["Agent not found.", "Агент не найден"],
  ["Agent placement is invalid.", "Некорректное положение агента"],
  ["Agent system prompt must contain at most 8000 characters.", "Системный промпт агента должен быть не длиннее 8000 символов"],
  ["Avatar file is empty.", "Файл аватарки пустой"],
  ["Avatar file is too large.", "Файл аватарки слишком большой"],
  ["Avatar image format is not supported.", "Формат аватарки не поддерживается"],
  ["Avatar must be an image file.", "Аватарка должна быть изображением"],
  ["Base URL must be a valid http or https URL.", "Base URL должен быть корректной ссылкой http или https"],
  ["Chat session not found.", "Чат не найден"],
  ["Chat title cannot be empty.", "Название чата не может быть пустым"],
  ["Chat title must contain at most 200 characters.", "Название чата должно быть не длиннее 200 символов"],
  ["Could not save session file.", "Не удалось сохранить файл"],
  ["File content type is too long.", "Тип файла слишком длинный"],
  ["File is empty.", "Файл пустой"],
  ["File name cannot be empty.", "Имя файла не может быть пустым"],
  ["File name must contain at most 255 characters.", "Имя файла должно быть не длиннее 255 символов"],
  ["Folder ID is required for Yandex AI Studio.", "Для Yandex AI Studio нужно указать Folder ID"],
  ["Folder ID must contain at most 255 characters.", "Folder ID должен быть не длиннее 255 символов"],
  ["Invalid access token.", "Сессия истекла. Войдите заново"],
  ["LLM model provider is not configured.", "LLM модель не настроена"],
  ["Missing access token.", "Сессия истекла. Войдите заново"],
  ["Model must contain at most 255 characters.", "Название модели должно быть не длиннее 255 символов"],
  ["Name fields cannot be empty strings.", "Имя и фамилия не могут быть пустыми строками"],
  ["New password confirmation does not match.", "Повтор нового пароля не совпадает"],
  ["Old password is incorrect.", "Старый пароль указан неверно"],
  ["Only superadmin can create admins.", "Только суперадмин может создавать администраторов"],
  ["Only superadmin can grant admin access.", "Только суперадмин может выдавать права администратора"],
  ["Password cannot start or end with spaces.", "Пароль не может начинаться или заканчиваться пробелом"],
  ["Password must contain at least 8 characters.", "Пароль должен содержать минимум 8 символов"],
  ["Provider connection test failed.", "Не удалось подключиться к провайдеру"],
  ["Provider rejected the API token.", "Провайдер отклонил API-ключ"],
  ["Provider returned an empty completion.", "Провайдер вернул пустой ответ"],
  ["Provider returned an invalid completion.", "Провайдер вернул некорректный ответ"],
  ["Provider returned invalid agent configuration.", "Провайдер вернул некорректную настройку агента"],
  ["Selected agent not found.", "Выбранный агент не найден"],
  ["Selected model is not available from this provider.", "Выбранная модель недоступна у этого провайдера"],
  ["Session is no longer valid.", "Сессия больше недействительна. Войдите заново"],
  ["Superadmin cannot be deleted.", "Суперадмина нельзя удалить"],
  ["Superadmin cannot lose admin access.", "У суперадмина нельзя забрать права администратора"],
  ["Superadmin must remain active.", "Суперадмин должен оставаться активным"],
  ["Unknown agent icon.", "Неизвестная иконка агента"],
  ["Unknown model provider.", "Неизвестный провайдер модели"],
  ["Unknown provider type.", "Неизвестный тип провайдера"],
  ["Use delete endpoint for logical deletion.", "Для удаления пользователя используйте действие удаления"],
  ["User not found.", "Пользователь не найден"],
  ["User session is not active.", "Сессия пользователя не активна"],
  ["Username is already taken.", "Такой username уже занят"],
]);

const API_ERROR_PATTERNS = [
  {
    pattern: /^Only (\d+) agents can be created\.$/,
    buildMessage: ([count]) => `Можно создать не больше ${count} агентов`,
  },
  {
    pattern: /^Only (\d+) chats can be pinned\.$/,
    buildMessage: ([count]) => `Можно закрепить не больше ${count} чатов`,
  },
  {
    pattern: /^Only (\d+) files can be attached to a chat\.$/,
    buildMessage: ([count]) => `К чату можно прикрепить не больше ${count} файлов`,
  },
  {
    pattern: /^Session file is too large\. Maximum size is (\d+) bytes\.$/,
    buildMessage: ([bytes]) => `Файл слишком большой. Максимальный размер: ${formatBytes(Number(bytes))}`,
  },
];

export function formatApiErrorMessage(message, fallbackMessage) {
  const rawMessage = typeof message === "string" && message.trim() ? message.trim() : fallbackMessage;
  const translatedMessage = API_ERROR_TRANSLATIONS.get(rawMessage) ?? translatePattern(rawMessage) ?? rawMessage;

  return trimFinalDot(translatedMessage);
}

function translatePattern(message) {
  for (const { pattern, buildMessage } of API_ERROR_PATTERNS) {
    const match = message.match(pattern);

    if (match) {
      return buildMessage(match.slice(1));
    }
  }

  return null;
}

function trimFinalDot(message) {
  if (message.endsWith("...")) {
    return message;
  }

  return message.replace(/\.$/, "");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "100 МБ";
  }

  const megabytes = bytes / (1024 * 1024);

  if (megabytes >= 1) {
    return `${Math.round(megabytes)} МБ`;
  }

  const kilobytes = bytes / 1024;

  return `${Math.max(1, Math.round(kilobytes))} КБ`;
}
