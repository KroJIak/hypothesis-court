import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { AgentAvatar } from "./AgentAvatar";
import { getGraphNodeIdForSource } from "../model/knowledgeGraphModel";
import { clampNumber } from "../utils/format";

const SOURCE_TOOLTIP_GAP = 10;
const SOURCE_TOOLTIP_EDGE_OFFSET = 14;

function getAgentDisplayName(agent) {
  return agent?.name || "Агент";
}

function createSourceQuote(excerpt) {
  const words = excerpt.split(/\s+/u).filter(Boolean);

  if (words.length < 8) {
    return {
      quote: excerpt,
      contextBefore: "",
      contextAfter: "",
    };
  }

  return {
    quote: words.slice(2, Math.min(words.length, 10)).join(" "),
    contextBefore: words.slice(0, 2).join(" "),
    contextAfter: words.slice(10, 18).join(" "),
  };
}

function getPrimarySource(session, hypothesis) {
  const evidenceById = new Map((session.evidence ?? []).map((evidence) => [evidence.id, evidence]));
  const primaryEvidence = (hypothesis.evidenceLinks ?? [])
    .map((link) => evidenceById.get(link.evidenceId))
    .find(Boolean);

  if (!primaryEvidence) {
    return null;
  }

  const excerpt = primaryEvidence.quote || primaryEvidence.summary || primaryEvidence.title;

  return {
    evidenceId: primaryEvidence.id,
    attachmentId: primaryEvidence.sessionFileId,
    nodeId: `evidence:${primaryEvidence.id}`,
    title: primaryEvidence.title,
    excerpt,
    ...createSourceQuote(excerpt),
  };
}

function getDebateAgent(session, roleId) {
  return (session.debate?.roles ?? []).find((role) => role.id === roleId) ?? {
    id: roleId,
    name: roleId,
    variant: roleId,
  };
}

function getManufacturerAgent(session) {
  return getDebateAgent(session, "manufacturer");
}

function getDebateMessageSide(role) {
  if (role === "attacker") {
    return "right";
  }

  if (role === "manufacturer") {
    return "center";
  }

  return "left";
}

function getLatestManufacturerMessage(hypothesis) {
  return (hypothesis.debateMessages ?? [])
    .filter((message) => message.role === "manufacturer")
    .sort((firstMessage, secondMessage) =>
      secondMessage.roundNumber - firstMessage.roundNumber
      || new Date(secondMessage.createdAt).getTime() - new Date(firstMessage.createdAt).getTime(),
    )[0] ?? null;
}

function createDebateMessages(session, hypothesis) {
  const source = getPrimarySource(session, hypothesis);
  const messages = [];
  let currentRound = null;

  (hypothesis.debateMessages ?? [])
    .sort((firstMessage, secondMessage) =>
      firstMessage.roundNumber - secondMessage.roundNumber
      || new Date(firstMessage.createdAt).getTime() - new Date(secondMessage.createdAt).getTime(),
    )
    .forEach((message) => {
      if (message.roundNumber !== currentRound) {
        currentRound = message.roundNumber;
        messages.push({
          id: `${hypothesis.id}-round-${currentRound}`,
          type: "divider",
          label: `${currentRound} цикл`,
        });
      }
      messages.push({
        id: message.id,
        type: "message",
        side: getDebateMessageSide(message.role),
        agent: getDebateAgent(session, message.role),
        text: message.content,
        source,
      });
    });

  return messages;
}

function createEvaluationMessages(session, targetAgent, hypothesis) {
  const source = getPrimarySource(session, hypothesis);
  const manufacturerMessage = getLatestManufacturerMessage(hypothesis);
  const messages = [];
  const evaluationMessages = (hypothesis.evaluations ?? [])
    .filter((evaluation) =>
      evaluation.userAgentId === targetAgent?.id
      || evaluation.evaluatorKey === targetAgent?.id,
    )
    .map((evaluation) => ({
      id: evaluation.id,
      type: "message",
      side: "left",
      agent: targetAgent ?? {
        id: evaluation.evaluatorKey,
        name: evaluation.evaluatorName,
        variant: evaluation.evaluatorKey,
      },
      text: [
        evaluation.verdict,
        evaluation.rationale,
        evaluation.riskNotes ? `Риски: ${evaluation.riskNotes}` : "",
      ].filter(Boolean).join(" "),
      source,
    }));

  if (manufacturerMessage) {
    messages.push({
      id: `${manufacturerMessage.id}-for-evaluation-${targetAgent?.id ?? "agent"}`,
      type: "message",
      side: "right",
      agent: getManufacturerAgent(session),
      text: manufacturerMessage.content,
      source,
    });
  }

  return [...messages, ...evaluationMessages];
}

function createJudgeMessages(session, hypothesis) {
  const source = getPrimarySource(session, hypothesis);
  const manufacturerMessage = getLatestManufacturerMessage(hypothesis);
  const messages = [];

  if (manufacturerMessage) {
    messages.push({
      id: `${manufacturerMessage.id}-for-judge`,
      type: "message",
      side: "left",
      agent: getManufacturerAgent(session),
      text: manufacturerMessage.content,
      source,
    });
  }

  for (const evaluation of hypothesis.evaluations ?? []) {
    const agent = (session.evaluation?.agents ?? []).find((candidate) =>
      candidate.id === evaluation.userAgentId
      || candidate.id === evaluation.evaluatorKey,
    ) ?? {
      id: evaluation.evaluatorKey,
      name: evaluation.evaluatorName,
      variant: evaluation.evaluatorKey,
    };

    messages.push({
      id: `${evaluation.id}-for-judge`,
      type: "message",
      side: "left",
      agent,
      text: [
        evaluation.verdict,
        evaluation.rationale,
        evaluation.riskNotes ? `Риски: ${evaluation.riskNotes}` : "",
      ].filter(Boolean).join(" "),
      source,
    });
  }

  return messages;
}

function createHistoryTabs(session, target) {
  const hypotheses = session.hypotheses ?? [];

  return hypotheses.map((hypothesis, index) => ({
    id: hypothesis.id,
    buttonLabel: `Гипотеза ${index + 1}`,
    title: hypothesis.title || `Гипотеза ${index + 1}`,
    messages: createHistoryMessages(session, target, hypothesis),
  }));
}

function createHistoryMessages(session, target, hypothesis) {
  if (target.type === "debate") {
    return createDebateMessages(session, hypothesis);
  }

  if (target.type === "judge") {
    return createJudgeMessages(session, hypothesis);
  }

  return createEvaluationMessages(session, target.agent, hypothesis);
}

function getHistoryTitle(target) {
  if (target.type === "debate") {
    return "Общий чат троицы";
  }

  if (target.type === "judge") {
    return "Материалы для судьи";
  }

  return getAgentDisplayName(target.agent);
}

export function AgentMessageHistoryModal({
  session,
  target,
  onClose,
  onOpenKnowledgeGraph,
}) {
  const [activeHypothesisId, setActiveHypothesisId] = useState(null);
  const [sourceTooltip, setSourceTooltip] = useState(null);
  const historyTabs = useMemo(() => createHistoryTabs(session, target), [session, target]);
  const activeTab = historyTabs.find((tab) => tab.id === activeHypothesisId) ?? historyTabs[0] ?? null;

  useEffect(() => {
    setActiveHypothesisId((currentId) =>
      historyTabs.some((tab) => tab.id === currentId) ? currentId : historyTabs[0]?.id ?? null,
    );
  }, [historyTabs]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const hideSourceTooltip = useCallback(() => {
    setSourceTooltip(null);
  }, []);

  useEffect(() => {
    if (!sourceTooltip) {
      return undefined;
    }

    window.addEventListener("scroll", hideSourceTooltip, true);
    window.addEventListener("resize", hideSourceTooltip);

    return () => {
      window.removeEventListener("scroll", hideSourceTooltip, true);
      window.removeEventListener("resize", hideSourceTooltip);
    };
  }, [hideSourceTooltip, sourceTooltip]);

  function showSourceTooltip(event, source) {
    const linkRect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = 280;
    const left = clampNumber(
      linkRect.left + (linkRect.width / 2) - (tooltipWidth / 2),
      SOURCE_TOOLTIP_EDGE_OFFSET,
      window.innerWidth - tooltipWidth - SOURCE_TOOLTIP_EDGE_OFFSET,
    );
    const top = Math.max(linkRect.bottom + SOURCE_TOOLTIP_GAP, SOURCE_TOOLTIP_EDGE_OFFSET);

    setSourceTooltip({
      source,
      style: {
        left: `${left}px`,
        top: `${top}px`,
        width: `${tooltipWidth}px`,
      },
    });
  }

  function handleOpenSource(event, source) {
    event.preventDefault();
    onOpenKnowledgeGraph?.({
      source: "agent-history",
      focusNodeId: getGraphNodeIdForSource(source),
    });
  }

  return createPortal(
    <div className="agent-history-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="agent-history-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`История сообщений: ${getAgentDisplayName(target.agent)}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="agent-history-modal__close"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X strokeWidth={2} />
        </button>

        <header className="agent-history-modal__header">
          <span className="agent-history-modal__eyebrow">История сообщений</span>
          <h2 className="agent-history-modal__title">{getHistoryTitle(target)}</h2>
        </header>

        {historyTabs.length > 0 ? (
          <div className="agent-history-modal__tabs" role="tablist" aria-label="Гипотезы">
            {historyTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={
                  activeTab?.id === tab.id
                    ? "agent-history-modal__tab agent-history-modal__tab--active"
                    : "agent-history-modal__tab"
                }
                role="tab"
                aria-selected={activeTab?.id === tab.id}
                onClick={() => setActiveHypothesisId(tab.id)}
              >
                {tab.buttonLabel}
              </button>
            ))}
          </div>
        ) : null}

        {activeTab ? (
          <h3 className="agent-history-modal__hypothesis-title">{activeTab.title}</h3>
        ) : null}

        <div className="agent-history-modal__body">
          {activeTab ? (
            <div className="agent-history-chat" aria-label={`История по ${activeTab.title}`}>
              {activeTab.messages.map((message) => (
                message.type === "divider" ? (
                  <div key={message.id} className="agent-history-chat__cycle">
                    <span>{message.label}</span>
                  </div>
                ) : (
                  <article
                    key={message.id}
                    className={`agent-history-message agent-history-message--${message.side}`}
                  >
                    {message.side !== "center" ? (
                      <AgentAvatar variant={message.agent?.variant} size="compact" />
                    ) : null}
                    <div className="agent-history-message__bubble">
                      <span className="agent-history-message__author">{getAgentDisplayName(message.agent)}</span>
                      <p className="agent-history-message__text">
                        {message.text}
                        {message.source ? (
                          <>
                            {" "}
                            <button
                              type="button"
                              className="agent-history-message__source"
                              onMouseEnter={(event) => showSourceTooltip(event, message.source)}
                              onMouseLeave={hideSourceTooltip}
                              onFocus={(event) => showSourceTooltip(event, message.source)}
                              onBlur={hideSourceTooltip}
                              onClick={(event) => handleOpenSource(event, message.source)}
                            >
                              источник
                            </button>
                          </>
                        ) : null}
                      </p>
                    </div>
                    {message.side === "center" ? (
                      <AgentAvatar variant={message.agent?.variant} size="compact" />
                    ) : null}
                  </article>
                )
              ))}
            </div>
          ) : (
            <div className="agent-history-modal__empty">
              История появится после генерации гипотез.
            </div>
          )}
        </div>

        {sourceTooltip && typeof document !== "undefined"
          ? createPortal(
              <div className="agent-history-source-tooltip" style={sourceTooltip.style}>
                <strong>{sourceTooltip.source.title}</strong>
                <p className="agent-history-source-tooltip__quote">
                  {sourceTooltip.source.contextBefore ? <span>{sourceTooltip.source.contextBefore} </span> : null}
                  <b>{sourceTooltip.source.quote}</b>
                  {sourceTooltip.source.contextAfter ? <span> {sourceTooltip.source.contextAfter}</span> : null}
                </p>
              </div>,
              document.body,
            )
          : null}
      </section>
    </div>,
    document.body,
  );
}
