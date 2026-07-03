import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrainCircuit } from "lucide-react";

import { ProcessingStatusBadge } from "./ProcessingStatusBadge";
import { clampNumber } from "../utils/format";

const HYPOTHESIS_PREVIEW_EDGE_OFFSET = 14;
const HYPOTHESIS_PREVIEW_HEIGHT = 126;
const HYPOTHESIS_VISIBLE_COUNT = 3;
const HYPOTHESIS_FALLBACK_CARD_WIDTH = 220;
const HYPOTHESIS_SKELETON_COUNT = 3;

export function HypothesisCandidates({ hypotheses, isLoading = false }) {
  const visibleHypotheses = hypotheses ?? [];
  const displayedHypotheses = isLoading
    ? Array.from({ length: HYPOTHESIS_SKELETON_COUNT }, (_, index) => ({ id: `hypothesis-skeleton-${index}` }))
    : visibleHypotheses;
  const hypothesisCount = displayedHypotheses.length;
  const sectionRef = useRef(null);
  const cardRefs = useRef(new Map());
  const hidePreviewTimeoutRef = useRef(null);
  const [activeHypothesisId, setActiveHypothesisId] = useState(null);
  const [cardWidth, setCardWidth] = useState(HYPOTHESIS_FALLBACK_CARD_WIDTH);
  const [previewStyle, setPreviewStyle] = useState({ left: "0px", top: "0px", width: "0px" });
  const activeHypothesis = visibleHypotheses.find((hypothesis) => hypothesis.id === activeHypothesisId) ?? null;
  let layoutMode = "full";

  if (hypothesisCount === 0) {
    layoutMode = "empty";
  } else if (hypothesisCount < 3) {
    layoutMode = "compact";
  }

  const setCardRef = useCallback((hypothesisId, node) => {
    if (node) {
      cardRefs.current.set(hypothesisId, node);
      return;
    }

    cardRefs.current.delete(hypothesisId);
  }, []);

  const updatePreviewPosition = useCallback((hypothesisId, sourceElement = null) => {
    const cardElement = sourceElement ?? cardRefs.current.get(hypothesisId);

    if (!cardElement) {
      return;
    }

    const cardRect = cardElement.getBoundingClientRect();
    const previewWidth = cardRect.width;
    const previewLeft = clampNumber(
      cardRect.left,
      HYPOTHESIS_PREVIEW_EDGE_OFFSET,
      window.innerWidth - previewWidth - HYPOTHESIS_PREVIEW_EDGE_OFFSET,
    );
    const previewTop = clampNumber(
      cardRect.top,
      HYPOTHESIS_PREVIEW_EDGE_OFFSET,
      window.innerHeight - HYPOTHESIS_PREVIEW_HEIGHT - HYPOTHESIS_PREVIEW_EDGE_OFFSET,
    );

    setPreviewStyle({
      left: `${previewLeft}px`,
      top: `${previewTop}px`,
      width: `${previewWidth}px`,
    });
  }, []);

  const showPreview = useCallback((hypothesisId, sourceElement) => {
    window.clearTimeout(hidePreviewTimeoutRef.current);
    setActiveHypothesisId(hypothesisId);
    updatePreviewPosition(hypothesisId, sourceElement);
  }, [updatePreviewPosition]);

  const hidePreview = useCallback(() => {
    window.clearTimeout(hidePreviewTimeoutRef.current);
    setActiveHypothesisId(null);
  }, []);

  const hidePreviewSoon = useCallback(() => {
    window.clearTimeout(hidePreviewTimeoutRef.current);
    hidePreviewTimeoutRef.current = window.setTimeout(() => {
      setActiveHypothesisId(null);
    }, 90);
  }, []);

  const keepPreviewVisible = useCallback(() => {
    window.clearTimeout(hidePreviewTimeoutRef.current);
  }, []);

  useEffect(() => {
    const sectionElement = sectionRef.current;

    if (!sectionElement) {
      return undefined;
    }

    const updateCardWidth = () => {
      const sectionStyle = window.getComputedStyle(sectionElement);
      const gap = Number.parseFloat(sectionStyle.getPropertyValue("--hypothesis-card-gap")) || 8;
      const nextCardWidth = (sectionElement.clientWidth - gap * (HYPOTHESIS_VISIBLE_COUNT - 1)) / HYPOTHESIS_VISIBLE_COUNT;

      setCardWidth(Math.max(1, nextCardWidth));
    };

    updateCardWidth();

    const resizeObserver = new ResizeObserver(updateCardWidth);
    resizeObserver.observe(sectionElement);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(hidePreviewTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!activeHypothesisId) {
      return undefined;
    }

    window.addEventListener("scroll", hidePreview, true);
    window.addEventListener("resize", hidePreview);

    return () => {
      window.removeEventListener("scroll", hidePreview, true);
      window.removeEventListener("resize", hidePreview);
    };
  }, [activeHypothesisId, hidePreview]);

  return (
    <section
      ref={sectionRef}
      className={`hypothesis-candidates hypothesis-candidates--${layoutMode} hypothesis-candidates--count-${Math.min(hypothesisCount, 3)}`}
      style={{ "--hypothesis-card-width": `${cardWidth}px` }}
      aria-label="Сформулированные гипотезы"
    >
      <div className="hypothesis-candidates__content">
        <div className="hypothesis-candidates__agent" aria-label="Системный агент формулирования гипотез">
          <BrainCircuit aria-hidden="true" strokeWidth={1.75} />
        </div>

        {hypothesisCount > 0 ? (
          <div className="hypothesis-candidates__list">
            {displayedHypotheses.map((hypothesis) => (
              <article
                ref={(node) => setCardRef(hypothesis.id, node)}
                key={hypothesis.id}
                className={isLoading ? "hypothesis-card hypothesis-card--skeleton" : "hypothesis-card"}
                onMouseEnter={isLoading ? undefined : (event) => showPreview(hypothesis.id, event.currentTarget)}
                onMouseLeave={isLoading ? undefined : hidePreviewSoon}
                onFocus={isLoading ? undefined : (event) => showPreview(hypothesis.id, event.currentTarget)}
                onBlur={isLoading ? undefined : hidePreview}
                tabIndex={isLoading ? undefined : 0}
                aria-hidden={isLoading ? true : undefined}
              >
                {isLoading ? (
                  <>
                    <span className="hypothesis-card__skeleton-line hypothesis-card__skeleton-line--title" />
                    <span className="hypothesis-card__skeleton-line" />
                    <span className="hypothesis-card__skeleton-line hypothesis-card__skeleton-line--short" />
                  </>
                ) : (
                  <>
                    <ProcessingStatusBadge status={hypothesis.processingStatus} />
                    <h2 className="hypothesis-card__title">{hypothesis.title}</h2>
                    <p className="hypothesis-card__description">{hypothesis.description}</p>
                  </>
                )}
              </article>
            ))}
          </div>
        ) : null}
      </div>
      {activeHypothesis && typeof document !== "undefined"
        ? createPortal(
            <article
              className="hypothesis-card-preview"
              style={previewStyle}
              role="tooltip"
              onMouseEnter={keepPreviewVisible}
              onMouseLeave={hidePreview}
            >
              <ProcessingStatusBadge status={activeHypothesis.processingStatus} />
              <h2 className="hypothesis-card-preview__title">{activeHypothesis.title}</h2>
              <p className="hypothesis-card-preview__description">{activeHypothesis.description}</p>
            </article>,
            document.body,
          )
        : null}
    </section>
  );
}
