import { getApiBaseUrl } from "../../../api/baseUrl";
import { readWorkspaceApiError } from "./readWorkspaceApiError";

function mapChatSession(dto) {
  return {
    id: dto.id,
    title: dto.title,
    isStarted: Boolean(dto.is_started),
    isPinned: Boolean(dto.is_pinned),
    pinnedAt: dto.pinned_at ?? null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export async function listChatSessions({ accessToken, search, signal }) {
  const params = new URLSearchParams({
    limit: "100",
    offset: "0",
  });

  const normalizedSearch = (search ?? "").trim();
  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  const response = await fetch(`${getApiBaseUrl()}/chat-sessions?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, "Не удалось загрузить историю чатов");
    throw new Error(detail);
  }

  const payload = await response.json();

  return {
    ...payload,
    items: (payload.items ?? []).map(mapChatSession),
    maxPinned: payload.max_pinned,
  };
}

export async function createChatSession({ accessToken, title }) {
  const response = await fetch(`${getApiBaseUrl()}/chat-sessions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, "Не удалось создать чат");
    throw new Error(detail);
  }

  return mapChatSession(await response.json());
}

export async function renameChatSession({ accessToken, chatSessionId, title }) {
  const response = await fetch(`${getApiBaseUrl()}/chat-sessions/${chatSessionId}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, "Не удалось переименовать чат");
    throw new Error(detail);
  }

  return mapChatSession(await response.json());
}

export async function pinChatSession({ accessToken, chatSessionId }) {
  const response = await fetch(`${getApiBaseUrl()}/chat-sessions/${chatSessionId}/pin`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, "Не удалось закрепить чат");
    throw new Error(detail);
  }

  return mapChatSession(await response.json());
}

export async function unpinChatSession({ accessToken, chatSessionId }) {
  const response = await fetch(`${getApiBaseUrl()}/chat-sessions/${chatSessionId}/unpin`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, "Не удалось открепить чат");
    throw new Error(detail);
  }

  return mapChatSession(await response.json());
}

export async function startChatSession({ accessToken, chatSessionId }) {
  const response = await fetch(`${getApiBaseUrl()}/chat-sessions/${chatSessionId}/start`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, "Не удалось запустить чат");
    throw new Error(detail);
  }

  return mapChatSession(await response.json());
}

export async function deleteChatSession({ accessToken, chatSessionId }) {
  const response = await fetch(`${getApiBaseUrl()}/chat-sessions/${chatSessionId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, "Не удалось удалить чат");
    throw new Error(detail);
  }
}
