import {
  BookOpenText,
  FileText,
  ShieldAlert,
  Target,
} from "lucide-react";

const requestIconByContextValue = {
  constraints: ShieldAlert,
  context: BookOpenText,
  kpi: Target,
};

function getRequestIcon(contextValue) {
  return requestIconByContextValue[contextValue] ?? FileText;
}

export function RequestSummaryRail({ requests }) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div
      className="request-summary-rail"
      aria-label="Параметры запущенного исследования"
    >
      {requests.map((request) => {
        const RequestIcon = getRequestIcon(request.context.value);

        return (
          <button
            key={request.id}
            type="button"
            className="request-summary-card"
            aria-label={`${request.context.label}: ${request.text}`}
          >
            <RequestIcon aria-hidden="true" strokeWidth={1.8} />
            <span className="request-summary-card__label">{request.context.label}</span>
            <span className="request-summary-card__tooltip" role="tooltip">
              <span className="request-summary-card__tooltip-type">{request.context.label}</span>
              <span className="request-summary-card__tooltip-text">{request.text}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
