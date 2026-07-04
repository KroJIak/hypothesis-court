import { getApiBaseUrl } from "../../../api/baseUrl";
import { readApiError } from "./readApiError";

export async function changeOwnPassword({
  accessToken,
  oldPassword,
  newPassword,
  newPasswordRepeat,
}) {
  const response = await fetch(`${getApiBaseUrl()}/users/me/change-password`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
      new_password_repeat: newPasswordRepeat,
    }),
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось сменить пароль");
    throw new Error(detail);
  }

  return response.json();
}
