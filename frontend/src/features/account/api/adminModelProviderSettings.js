import { getApiBaseUrl } from "../../../api/baseUrl";
import { readApiError } from "./readApiError";

export async function getOpenAIProviderSettings(accessToken) {
  const response = await fetch(`${getApiBaseUrl()}/admin/model-providers/openai`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось загрузить настройки провайдера.");
    throw new Error(detail);
  }

  return response.json();
}

export async function updateOpenAIProviderSettings({ accessToken, baseUrl, apiToken }) {
  const body = {
    base_url: baseUrl,
  };

  if (apiToken) {
    body.api_token = apiToken;
  }

  const response = await fetch(`${getApiBaseUrl()}/admin/model-providers/openai`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось сохранить настройки провайдера.");
    throw new Error(detail);
  }

  return response.json();
}
