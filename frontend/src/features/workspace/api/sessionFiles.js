import { getApiBaseUrl } from "../../../api/baseUrl";
import { normalizeAttachmentProcessingStatus } from "../utils/processingStatus";
import { readWorkspaceApiError } from "./readWorkspaceApiError";

function mapSessionFile(dto) {
  const kind = dto.kind || "file";

  return {
    id: dto.id,
    kind,
    shortLabel: kind.toUpperCase(),
    tooltip: dto.original_filename,
    fileName: dto.original_filename,
    sizeBytes: dto.size_bytes,
    downloadUrl: dto.download_url,
    processingStatus: normalizeAttachmentProcessingStatus(dto.processing_status),
    processingError: dto.processing_error ?? null,
    textExtractedAt: dto.text_extracted_at ?? null,
    createdAt: dto.created_at,
  };
}

export async function listSessionFiles({ accessToken, chatSessionId, signal }) {
  const response = await fetch(`${getApiBaseUrl()}/chat-sessions/${chatSessionId}/files`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, "Не удалось загрузить файлы чата");
    throw new Error(detail);
  }

  const payload = await response.json();

  return {
    ...payload,
    items: (payload.items ?? []).map(mapSessionFile),
    maxFiles: payload.max_files,
  };
}

export async function uploadSessionFile({ accessToken, chatSessionId, file }) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiBaseUrl()}/chat-sessions/${chatSessionId}/files`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, "Не удалось загрузить файл");
    throw new Error(detail);
  }

  return mapSessionFile(await response.json());
}

export async function deleteSessionFile({ accessToken, chatSessionId, sessionFileId }) {
  const response = await fetch(`${getApiBaseUrl()}/chat-sessions/${chatSessionId}/files/${sessionFileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, "Не удалось удалить файл");
    throw new Error(detail);
  }
}
