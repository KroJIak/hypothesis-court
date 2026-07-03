import { BrainCircuit } from "lucide-react";

import { ProcessingStatusBadge } from "./ProcessingStatusBadge";

export function HypothesisCandidates({ hypotheses }) {
  const visibleHypotheses = hypotheses ?? [];
  const hypothesisCount = visibleHypotheses.length;
  let layoutMode = "full";

  if (hypothesisCount === 0) {
    layoutMode = "empty";
  } else if (hypothesisCount < 3) {
    layoutMode = "compact";
  }

  return (
    <section
      className={`hypothesis-candidates hypothesis-candidates--${layoutMode} hypothesis-candidates--count-${Math.min(hypothesisCount, 3)}`}
      aria-label="Сформулированные гипотезы"
    >
      <div className="hypothesis-candidates__content">
        <div className="hypothesis-candidates__agent" aria-label="Системный агент формулирования гипотез">
          <BrainCircuit aria-hidden="true" strokeWidth={1.75} />
        </div>

        {hypothesisCount > 0 ? (
          <div className="hypothesis-candidates__list">
            {visibleHypotheses.map((hypothesis) => (
              <article key={hypothesis.id} className="hypothesis-card">
                <ProcessingStatusBadge status={hypothesis.processingStatus} />
                <h2 className="hypothesis-card__title">{hypothesis.title}</h2>
                <p className="hypothesis-card__description">{hypothesis.description}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
