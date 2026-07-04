import { PROCESSING_STATUS_PROCESSING, PROCESSING_STATUS_PROCESSED } from "../constants";

export function normalizeAttachmentProcessingStatus(status) {
  return status === PROCESSING_STATUS_PROCESSED
    ? PROCESSING_STATUS_PROCESSED
    : PROCESSING_STATUS_PROCESSING;
}
