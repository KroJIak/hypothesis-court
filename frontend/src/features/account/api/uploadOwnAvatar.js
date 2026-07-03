import { getApiBaseUrl } from "../../../api/baseUrl";
import { readApiError } from "./readApiError";

export async function uploadOwnAvatar({ accessToken, file }) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiBaseUrl()}/users/me/avatar`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось загрузить изображение.");
    throw new Error(detail);
  }

  return response.json();
}
