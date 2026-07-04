import { getApiBaseUrl } from "../../../api/baseUrl";
import { readApiError } from "./readApiError";

export async function updateOwnProfile({ accessToken, firstName, lastName }) {
  const response = await fetch(`${getApiBaseUrl()}/users/me/profile`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: firstName || null,
      last_name: lastName || null,
    }),
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось сохранить профиль");
    throw new Error(detail);
  }

  return response.json();
}
