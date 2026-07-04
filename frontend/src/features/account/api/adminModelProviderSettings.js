import { getApiBaseUrl } from "../../../api/baseUrl";
import { readApiError } from "./readApiError";

function getProviderUrl(provider) {
  return `${getApiBaseUrl()}/admin/model-providers/${provider}`;
}

function buildProviderBody({ providerType, baseUrl, projectId, apiToken, model }) {
  const body = {
    provider_type: providerType,
    base_url: baseUrl,
  };

  if (projectId) {
    body.project_id = projectId;
  }

  if (model) {
    body.model = model;
  }

  if (apiToken) {
    body.api_token = apiToken;
  }

  return body;
}

export async function getProviderSettings({ accessToken, provider }) {
  const response = await fetch(getProviderUrl(provider), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось загрузить настройки провайдера");
    throw new Error(detail);
  }

  return response.json();
}

export async function updateProviderSettings({
  accessToken,
  provider,
  providerType,
  baseUrl,
  projectId,
  apiToken,
  model,
}) {
  const body = buildProviderBody({ providerType, baseUrl, projectId, apiToken, model });

  const response = await fetch(getProviderUrl(provider), {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось сохранить настройки провайдера");
    throw new Error(detail);
  }

  return response.json();
}

export async function listProviderModels({ accessToken, provider, providerType, baseUrl, projectId, apiToken }) {
  const response = await fetch(`${getProviderUrl(provider)}/models`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildProviderBody({ providerType, baseUrl, projectId, apiToken })),
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось загрузить список моделей");
    throw new Error(detail);
  }

  return response.json();
}

export async function testProviderConnection({
  accessToken,
  provider,
  providerType,
  baseUrl,
  projectId,
  apiToken,
  model,
}) {
  const response = await fetch(`${getProviderUrl(provider)}/test`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildProviderBody({ providerType, baseUrl, projectId, apiToken, model })),
  });

  if (!response.ok) {
    const detail = await readApiError(response, "Не удалось проверить подключение");
    throw new Error(detail);
  }

  return response.json();
}
