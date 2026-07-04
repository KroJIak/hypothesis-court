import { getApiBaseUrl } from "../../../api/baseUrl";

export async function logoutAll(accessToken) {
  const response = await fetch(`${getApiBaseUrl()}/auth/logout-all`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Не удалось завершить все сессии");
  }
}
