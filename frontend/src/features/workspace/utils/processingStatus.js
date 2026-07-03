import {
  PROCESSING_STATUS_PROCESSING,
  PROCESSING_STATUS_PROCESSED,
  PROCESSING_STATUS_QUEUED,
} from "../constants";

export function getSequentialProcessingStatus(index, totalCount) {
  if (totalCount <= 0) {
    return PROCESSING_STATUS_QUEUED;
  }

  if (totalCount === 1) {
    return PROCESSING_STATUS_PROCESSING;
  }

  if (index === 0) {
    return PROCESSING_STATUS_PROCESSED;
  }

  if (index === 1) {
    return PROCESSING_STATUS_PROCESSING;
  }

  return PROCESSING_STATUS_QUEUED;
}

export function getBinaryProcessingStatus(index, totalCount) {
  if (totalCount <= 1) {
    return PROCESSING_STATUS_PROCESSING;
  }

  const processedCount = Math.max(1, Math.floor(totalCount * 0.35));

  return index < processedCount ? PROCESSING_STATUS_PROCESSED : PROCESSING_STATUS_PROCESSING;
}

export function normalizeAttachmentProcessingStatus(status) {
  return status === PROCESSING_STATUS_PROCESSED
    ? PROCESSING_STATUS_PROCESSED
    : PROCESSING_STATUS_PROCESSING;
}
