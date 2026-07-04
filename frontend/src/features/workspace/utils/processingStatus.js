import {
  DOCUMENT_PROCESSING_STATUS_CHUNKED,
  DOCUMENT_PROCESSING_STATUS_DONE,
  DOCUMENT_PROCESSING_STATUS_FAILED,
  DOCUMENT_PROCESSING_STATUS_INDEXED,
  DOCUMENT_PROCESSING_STATUS_PARSING,
  DOCUMENT_PROCESSING_STATUS_PROCESSED,
  DOCUMENT_PROCESSING_STATUS_PROCESSING,
  DOCUMENT_PROCESSING_STATUS_UNSUPPORTED,
  DOCUMENT_PROCESSING_STATUS_UPLOADED,
  PROCESSING_STATUS_PROCESSING,
  PROCESSING_STATUS_PROCESSED,
} from "../constants";

const attachmentProcessingMetaByStatus = {
  [DOCUMENT_PROCESSING_STATUS_UPLOADED]: {
    badgeStatus: PROCESSING_STATUS_PROCESSED,
    label: "Файл загружен",
  },
  [DOCUMENT_PROCESSING_STATUS_PROCESSING]: {
    badgeStatus: PROCESSING_STATUS_PROCESSING,
    label: "Обрабатывается: парсинг, разбиение и индексация",
  },
  [DOCUMENT_PROCESSING_STATUS_PARSING]: {
    badgeStatus: PROCESSING_STATUS_PROCESSING,
    label: "Парсинг файла",
  },
  [DOCUMENT_PROCESSING_STATUS_CHUNKED]: {
    badgeStatus: PROCESSING_STATUS_PROCESSING,
    label: "Текст разбит на фрагменты",
  },
  [DOCUMENT_PROCESSING_STATUS_INDEXED]: {
    badgeStatus: PROCESSING_STATUS_PROCESSING,
    label: "Фрагменты индексируются",
  },
  [DOCUMENT_PROCESSING_STATUS_PROCESSED]: {
    badgeStatus: PROCESSING_STATUS_PROCESSED,
    label: "Готово",
  },
  [DOCUMENT_PROCESSING_STATUS_DONE]: {
    badgeStatus: PROCESSING_STATUS_PROCESSED,
    label: "Готово",
  },
  [DOCUMENT_PROCESSING_STATUS_FAILED]: {
    badgeStatus: PROCESSING_STATUS_PROCESSING,
    label: "Ошибка обработки",
  },
  [DOCUMENT_PROCESSING_STATUS_UNSUPPORTED]: {
    badgeStatus: PROCESSING_STATUS_PROCESSING,
    label: "Формат пока не поддержан",
  },
};

export function normalizeAttachmentProcessingStatus(status) {
  return getAttachmentProcessingMeta(status).badgeStatus;
}

export function getAttachmentProcessingMeta(status) {
  const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : "";

  return attachmentProcessingMetaByStatus[normalizedStatus] ?? attachmentProcessingMetaByStatus[DOCUMENT_PROCESSING_STATUS_UPLOADED];
}

export function createAttachmentProcessingView(status) {
  const rawStatus = typeof status === "string" && status.trim()
    ? status.trim().toLowerCase()
    : DOCUMENT_PROCESSING_STATUS_UPLOADED;
  const meta = getAttachmentProcessingMeta(rawStatus);

  return {
    rawProcessingStatus: rawStatus,
    processingStatus: meta.badgeStatus,
    processingBadgeStatus: meta.badgeStatus,
    processingStatusLabel: meta.label,
  };
}

export function isAttachmentProcessedStatus(status) {
  return normalizeAttachmentProcessingStatus(status) === PROCESSING_STATUS_PROCESSED;
}

export function normalizeHypothesisProcessingStatus(status) {
  return status === PROCESSING_STATUS_PROCESSED
    ? PROCESSING_STATUS_PROCESSED
    : PROCESSING_STATUS_PROCESSING;
}
