import { getApiBaseUrl } from "../../../api/baseUrl";

export async function logout(accessToken) {
  const response = await fetch(`${getApiBaseUrl()}/auth/logout`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Не удалось завершить сессию.");
  }
}
