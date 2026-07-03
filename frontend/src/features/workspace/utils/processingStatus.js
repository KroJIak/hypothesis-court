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
