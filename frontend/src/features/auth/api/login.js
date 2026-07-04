import { formatApiErrorMessage } from "../../../api/apiErrorMessage";
import { getApiBaseUrl } from "../../../api/baseUrl";

export async function login({ username, password, signal }) {
  const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response, "Не удалось выполнить вход");
    throw new Error(detail);
  }

  return response.json();
}

async function readErrorDetail(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return formatApiErrorMessage(payload?.detail, fallbackMessage);
  } catch {
    return formatApiErrorMessage(null, fallbackMessage);
  }
}
