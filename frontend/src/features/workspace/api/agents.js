import { getApiBaseUrl } from "../../../api/baseUrl";
import { readWorkspaceApiError } from "./readWorkspaceApiError";

function mapAgent(dto) {
  return {
    id: dto.id,
    name: dto.name,
    variant: dto.variant ?? "empty",
    systemPrompt: dto.system_prompt ?? "",
    isCustom: Boolean(dto.is_custom),
    isEmpty: Boolean(dto.is_empty),
    isPendingSetup: false,
    createdAt: dto.created_at ?? null,
    updatedAt: dto.updated_at ?? null,
  };
}

function mapSelectedAgent(dto) {
  return {
    ...mapAgent(dto),
    placement: dto.placement,
    position: dto.position,
  };
}

function mapVariantToApi(variant) {
  return variant && variant !== "empty" ? variant : null;
}

async function readJsonResponse(response, fallbackMessage) {
  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, fallbackMessage);
    throw new Error(detail);
  }

  return response.json();
}

export async function listAgents({ accessToken, signal }) {
  const response = await fetch(`${getApiBaseUrl()}/agents`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });
  const payload = await readJsonResponse(response, "Не удалось загрузить агентов");

  return (payload.items ?? []).map(mapAgent);
}

export async function getAgentGenerationStatus({ accessToken, signal }) {
  const response = await fetch(`${getApiBaseUrl()}/agents/generation-status`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });
  const payload = await readJsonResponse(response, "Не удалось проверить доступность генерации");

  return Boolean(payload.available);
}

export async function createAgent({ accessToken, name, variant, systemPrompt }) {
  const response = await fetch(`${getApiBaseUrl()}/agents`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      variant: mapVariantToApi(variant),
      system_prompt: systemPrompt,
    }),
  });
  const payload = await readJsonResponse(response, "Не удалось создать агента");

  return mapAgent(payload);
}

export async function updateAgent({ accessToken, agentId, name, variant, systemPrompt }) {
  const response = await fetch(`${getApiBaseUrl()}/agents/${agentId}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      variant: mapVariantToApi(variant),
      system_prompt: systemPrompt,
    }),
  });
  const payload = await readJsonResponse(response, "Не удалось сохранить агента");

  return mapAgent(payload);
}

export async function deleteAgent({ accessToken, agentId }) {
  const response = await fetch(`${getApiBaseUrl()}/agents/${agentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, "Не удалось удалить агента");
    throw new Error(detail);
  }
}

export async function generateAgent({ accessToken, agentId, name, systemPrompt }) {
  const response = await fetch(`${getApiBaseUrl()}/agents/${agentId}/generate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      system_prompt: systemPrompt,
    }),
  });
  const payload = await readJsonResponse(response, "Не удалось сгенерировать промпт агента");

  return mapAgent(payload);
}

export async function listChatSessionAgents({ accessToken, chatSessionId, signal }) {
  const response = await fetch(`${getApiBaseUrl()}/chat-sessions/${chatSessionId}/agents`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });
  const payload = await readJsonResponse(response, "Не удалось загрузить агентов чата");

  return (payload.items ?? []).map(mapSelectedAgent);
}

export async function attachChatSessionAgent({ accessToken, chatSessionId, agentId, placement, position }) {
  const response = await fetch(`${getApiBaseUrl()}/chat-sessions/${chatSessionId}/agents`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agentId,
      placement,
      position,
    }),
  });
  const payload = await readJsonResponse(response, "Не удалось добавить агента в чат");

  return (payload.items ?? []).map(mapSelectedAgent);
}

export async function detachChatSessionAgent({ accessToken, chatSessionId, agentId }) {
  const response = await fetch(`${getApiBaseUrl()}/chat-sessions/${chatSessionId}/agents/${agentId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await readJsonResponse(response, "Не удалось убрать агента из чата");

  return (payload.items ?? []).map(mapSelectedAgent);
}
