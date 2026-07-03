import { getApiBaseUrl } from "../../../api/baseUrl";

export async function readCurrentUser(accessToken, signal) {
  const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error("Не удалось восстановить сессию.");
  }

  return response.json();
}
