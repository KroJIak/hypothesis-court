import { getApiBaseUrl } from "../../../api/baseUrl";
import { readApiError } from "./readApiError";

export async function listAdminUsers(accessToken) {
  const response = await fetch(`${getApiBaseUrl()}/users?status=active&limit=100&offset=0`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось загрузить пользователей");
    throw new Error(detail);
  }

  return response.json();
}

export async function createAdminUser({ accessToken, username, password, isAdmin }) {
  const response = await fetch(`${getApiBaseUrl()}/users`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
      is_admin: isAdmin,
    }),
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось создать пользователя");
    throw new Error(detail);
  }

  return response.json();
}

export async function updateAdminUserRole({ accessToken, userId, isAdmin }) {
  const response = await fetch(`${getApiBaseUrl()}/users/${userId}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      is_admin: isAdmin,
    }),
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось изменить роль пользователя");
    throw new Error(detail);
  }

  return response.json();
}

export async function resetAdminUserPassword({ accessToken, userId, newPassword }) {
  const response = await fetch(`${getApiBaseUrl()}/users/${userId}/reset-password`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      new_password: newPassword,
    }),
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось сменить пароль");
    throw new Error(detail);
  }

  return response.json();
}

export async function deleteAdminUser({ accessToken, userId }) {
  const response = await fetch(`${getApiBaseUrl()}/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось удалить пользователя");
    throw new Error(detail);
  }
}
