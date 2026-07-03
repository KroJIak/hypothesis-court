import { BrainCircuit } from "lucide-react";

export function HypothesisCandidates({ hypotheses }) {
  if (!hypotheses || hypotheses.length === 0) {
    return null;
  }

  return (
    <section className="hypothesis-candidates" aria-label="Сформулированные гипотезы">
      <div className="hypothesis-candidates__agent" aria-label="Системный агент формулирования гипотез">
        <BrainCircuit aria-hidden="true" strokeWidth={1.75} />
      </div>

      <div className="hypothesis-candidates__list">
        {hypotheses.map((hypothesis) => (
          <article key={hypothesis.id} className="hypothesis-card">
            <h2 className="hypothesis-card__title">{hypothesis.title}</h2>
            <p className="hypothesis-card__description">{hypothesis.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
