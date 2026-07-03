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
    const detail = await readErrorDetail(response);
    throw new Error(detail || "Не удалось выполнить вход.");
  }

  return response.json();
}

async function readErrorDetail(response) {
  try {
    const payload = await response.json();
    return typeof payload?.detail === "string" ? payload.detail : null;
  } catch {
    return null;
  }
}
