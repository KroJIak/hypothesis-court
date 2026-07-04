import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  BookOpenText,
  FileText,
  Target,
} from "lucide-react";

import { clampNumber } from "../utils/format";

const REQUEST_TOOLTIP_EDGE_OFFSET = 16;
const REQUEST_TOOLTIP_GAP = 8;

const requestIconByContextValue = {
  constraints: Ban,
  context: BookOpenText,
  kpi: Target,
};

function getRequestIcon(contextValue) {
  return requestIconByContextValue[contextValue] ?? FileText;
}

export function RequestSummaryRail({ requests, title }) {
  const requestButtonRefs = useRef(new Map());
  const [activeRequestId, setActiveRequestId] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({ left: "0px", top: "0px" });
  const activeRequest = requests.find((request) => request.id === activeRequestId) ?? null;

  const setRequestButtonRef = useCallback((requestId, node) => {
    if (node) {
      requestButtonRefs.current.set(requestId, node);
      return;
    }

    requestButtonRefs.current.delete(requestId);
  }, []);

  const updateTooltipPosition = useCallback((requestId, sourceElement = null) => {
    const buttonElement = sourceElement ?? requestButtonRefs.current.get(requestId);

    if (!buttonElement) {
      return;
    }

    const buttonRect = buttonElement.getBoundingClientRect();
    const tooltipLeft = clampNumber(
      buttonRect.left + buttonRect.width / 2,
      REQUEST_TOOLTIP_EDGE_OFFSET,
      window.innerWidth - REQUEST_TOOLTIP_EDGE_OFFSET,
    );
    const tooltipTop = clampNumber(
      buttonRect.bottom + REQUEST_TOOLTIP_GAP,
      REQUEST_TOOLTIP_EDGE_OFFSET,
      window.innerHeight - REQUEST_TOOLTIP_EDGE_OFFSET,
    );

    setTooltipStyle({
      left: `${tooltipLeft}px`,
      top: `${tooltipTop}px`,
    });
  }, []);

  const showTooltip = useCallback((requestId, sourceElement) => {
    setActiveRequestId(requestId);
    updateTooltipPosition(requestId, sourceElement);
  }, [updateTooltipPosition]);

  const hideTooltip = useCallback(() => {
    setActiveRequestId(null);
  }, []);

  const handleRailScroll = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  useEffect(() => {
    if (!activeRequestId) {
      return undefined;
    }

    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);

    return () => {
      window.removeEventListener("scroll", hideTooltip, true);
      window.removeEventListener("resize", hideTooltip);
    };
  }, [activeRequestId, hideTooltip]);

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="request-summary-group">
      {title ? <p className="request-summary-group__title">{title}</p> : null}
      <p className="request-summary-group__label">Вводные условия</p>
      <div
        className="request-summary-rail"
        aria-label="Параметры запущенного исследования"
        onScroll={handleRailScroll}
      >
        {requests.map((request) => {
          const RequestIcon = getRequestIcon(request.context.value);

          return (
            <button
              ref={(node) => setRequestButtonRef(request.id, node)}
              key={request.id}
              type="button"
              className="request-summary-card"
              aria-label={`${request.context.label}: ${request.text}`}
              onMouseEnter={(event) => showTooltip(request.id, event.currentTarget)}
              onMouseLeave={hideTooltip}
              onFocus={(event) => showTooltip(request.id, event.currentTarget)}
              onBlur={hideTooltip}
            >
              <RequestIcon aria-hidden="true" strokeWidth={1.8} />
            </button>
          );
        })}
      </div>
      {activeRequest && typeof document !== "undefined"
        ? createPortal(
            <span className="request-summary-card__tooltip" role="tooltip" style={tooltipStyle}>
              <span className="request-summary-card__tooltip-type">{activeRequest.context.label}</span>
              <span className="request-summary-card__tooltip-text">{activeRequest.text}</span>
            </span>,
            document.body,
          )
        : null}
    </div>
  );
}
