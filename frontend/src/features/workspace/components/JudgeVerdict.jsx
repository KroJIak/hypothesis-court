import { useEffect, useState } from "react";

const TYPEWRITER_INTERVAL_MS = 18;
const TYPEWRITER_CHUNK_SIZE = 4;
const verdictProgressBySession = new Map();
const PRIORITY_LABELS = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

export function resetJudgeVerdict(sessionId) {
  for (const progressKey of verdictProgressBySession.keys()) {
    if (progressKey.startsWith(`${sessionId}:`)) {
      verdictProgressBySession.delete(progressKey);
    }
  }
}

function getVerdictProgressKey(sessionId, answer) {
  return `${sessionId}:${answer}`;
}

function getInitialVisibleAnswer(sessionId, answer) {
  const cachedLength = verdictProgressBySession.get(getVerdictProgressKey(sessionId, answer)) ?? 0;

  return answer.slice(0, cachedLength);
}

function createVerdictSections(verdict) {
  if (!verdict) {
    return [];
  }

  return [
    {
      key: "summary",
      title: "Итоговый вывод",
      text: verdict.summary,
    },
    {
      key: "recommendation",
      title: "Рекомендация",
      text: verdict.recommendation,
    },
    {
      key: "nextChecks",
      title: "Что проверить сначала",
      items: verdict.nextChecks ?? [],
    },
  ].filter((section) =>
    section.text?.trim() || (section.items ?? []).some((item) => item?.trim()),
  );
}

function createSectionText(section) {
  if (section.items) {
    return section.items.filter(Boolean).join("\n");
  }

  return section.text ?? "";
}

function createNarrativeText(sections, fallbackAnswer) {
  const structuredText = sections
    .map(createSectionText)
    .filter(Boolean)
    .join("\n\n");

  return structuredText || fallbackAnswer || "";
}

function getVisibleSectionText(sectionText, visibleLength, consumedLength) {
  const remainingLength = visibleLength - consumedLength;

  if (remainingLength <= 0) {
    return "";
  }

  return sectionText.slice(0, remainingLength);
}

function getEntryValue(entry, camelKey, snakeKey) {
  return entry?.[camelKey] ?? entry?.[snakeKey];
}

function getRankedHypothesis(entry, hypotheses) {
  const explicitId = getEntryValue(entry, "hypothesisId", "hypothesis_id");

  if (explicitId) {
    return hypotheses.find((hypothesis) => hypothesis.id === explicitId) ?? null;
  }

  const rawIndexValue = getEntryValue(entry, "hypothesisIndex", "hypothesis_index");

  if (rawIndexValue === null || rawIndexValue === undefined) {
    return null;
  }

  const rawIndex = Number(rawIndexValue);

  if (!Number.isInteger(rawIndex)) {
    return null;
  }

  return hypotheses[rawIndex] ?? null;
}

function createRankingRows(verdict, hypotheses) {
  return (verdict?.ranking ?? [])
    .filter(Boolean)
    .map((entry, index) => {
      const hypothesis = getRankedHypothesis(entry, hypotheses);
      const rawPriority = entry.priority?.toString().toLowerCase();
      const rank = Number(entry.rank);

      return {
        key: `${hypothesis?.id ?? "unknown"}-${rank || index + 1}`,
        rank: Number.isFinite(rank) ? rank : index + 1,
        title: hypothesis?.title ?? "Гипотеза не найдена",
        priority: PRIORITY_LABELS[rawPriority] ?? entry.priority ?? "Не указан",
        reason: entry.reason ?? "",
        feasibility: hypothesis?.feasibility ?? "",
        riskProfile: hypothesis?.riskProfile ?? "",
      };
    })
    .sort((firstRow, secondRow) => firstRow.rank - secondRow.rank);
}

export function JudgeVerdict({
  answer,
  verdict = null,
  hypotheses = [],
  sessionId,
  onComplete,
  isReadyToType = true,
  shouldAnimate = false,
}) {
  const sections = createVerdictSections(verdict);
  const narrativeText = createNarrativeText(sections, answer);
  const rankingRows = createRankingRows(verdict, hypotheses);
  const hasStructuredVerdict = sections.length > 0 || rankingRows.length > 0;
  const [visibleAnswer, setVisibleAnswer] = useState(() =>
    shouldAnimate ? getInitialVisibleAnswer(sessionId, narrativeText) : narrativeText,
  );
  const isNarrativeComplete = visibleAnswer.length >= narrativeText.length;

  useEffect(() => {
    if (!shouldAnimate) {
      setVisibleAnswer(narrativeText);
      return undefined;
    }

    if (!isReadyToType) {
      setVisibleAnswer(getInitialVisibleAnswer(sessionId, narrativeText));
      return undefined;
    }

    if (!narrativeText) {
      setVisibleAnswer("");
      onComplete?.();
      return undefined;
    }

    const progressKey = getVerdictProgressKey(sessionId, narrativeText);
    let nextLength = verdictProgressBySession.get(progressKey) ?? 0;

    if (nextLength >= narrativeText.length) {
      setVisibleAnswer(narrativeText);
      onComplete?.();
      return undefined;
    }

    setVisibleAnswer(narrativeText.slice(0, nextLength));

    const intervalId = window.setInterval(() => {
      nextLength = Math.min(narrativeText.length, nextLength + TYPEWRITER_CHUNK_SIZE);
      verdictProgressBySession.set(progressKey, nextLength);
      setVisibleAnswer(narrativeText.slice(0, nextLength));

      if (nextLength >= narrativeText.length) {
        window.clearInterval(intervalId);
        onComplete?.();
      }
    }, TYPEWRITER_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isReadyToType, narrativeText, onComplete, sessionId, shouldAnimate]);

  if (!hasStructuredVerdict) {
    return (
      <div className="judge-verdict" aria-live="polite">
        <p className="judge-verdict__fallback">{visibleAnswer}</p>
      </div>
    );
  }

  let consumedLength = 0;

  return (
    <div className="judge-verdict" aria-live="polite">
      {sections.map((section) => {
        const sectionText = createSectionText(section);
        const visibleSectionText = getVisibleSectionText(sectionText, visibleAnswer.length, consumedLength);
        consumedLength += sectionText.length + 2;

        if (!visibleSectionText && shouldAnimate && !isNarrativeComplete) {
          return null;
        }

        return (
          <section key={section.key} className="judge-verdict__section">
            <h3 className="judge-verdict__heading">{section.title}</h3>
            {section.items ? (
              <ul className="judge-verdict__next-checks">
                {visibleSectionText.split("\n").filter(Boolean).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="judge-verdict__text">{visibleSectionText}</p>
            )}
          </section>
        );
      })}

      {rankingRows.length > 0 && isNarrativeComplete ? (
        <section className="judge-verdict__section judge-verdict__section--ranking">
          <h3 className="judge-verdict__heading">Рейтинг гипотез</h3>
          <div className="judge-verdict__ranking" role="region" aria-label="Рейтинг гипотез">
            <table>
              <thead>
                <tr>
                  <th>Место</th>
                  <th>Гипотеза</th>
                  <th>Приоритет</th>
                  <th>Обоснование</th>
                  <th>Реализуемость</th>
                  <th>Риски</th>
                </tr>
              </thead>
              <tbody>
                {rankingRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.rank}</td>
                    <td>{row.title}</td>
                    <td>{row.priority}</td>
                    <td>{row.reason || "Не указано"}</td>
                    <td>{row.feasibility || "Не указано"}</td>
                    <td>{row.riskProfile || "Не указаны"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
