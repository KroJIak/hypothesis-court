import { CircleCheck, LoaderCircle } from "lucide-react";

import {
  PROCESSING_STATUS_PROCESSING,
  PROCESSING_STATUS_PROCESSED,
} from "../constants";

const statusMeta = {
  [PROCESSING_STATUS_PROCESSING]: {
    className: "processing-status-badge processing-status-badge--processing",
    label: "Обрабатывается",
    Icon: LoaderCircle,
  },
  [PROCESSING_STATUS_PROCESSED]: {
    className: "processing-status-badge processing-status-badge--processed",
    label: "Обработано",
    Icon: CircleCheck,
  },
};

export function ProcessingStatusBadge({ status }) {
  const meta = statusMeta[status];

  if (!meta) {
    return null;
  }

  const { className, label, Icon } = meta;

  return (
    <span className={className} aria-label={label} title={label}>
      <Icon aria-hidden="true" strokeWidth={2} />
    </span>
  );
}
