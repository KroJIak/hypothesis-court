import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { AgentAvatar } from "./AgentAvatar";
import { getGraphNodeIdForSource } from "../model/knowledgeGraphModel";
import { clampNumber } from "../utils/format";

const DEBATE_ROLE_ORDER = ["defender", "attacker", "manufacturer"];
const DEBATE_CYCLE_COUNT = 3;
const SOURCE_TOOLTIP_GAP = 10;
const SOURCE_TOOLTIP_EDGE_OFFSET = 14;
const SOURCE_QUOTE_FALLBACK = "фрагмент связан с доказательством в графе";

function getAgentDisplayName(agent) {
  return agent?.name || "Агент";
}

function createSourceQuote(excerpt) {
  const words = excerpt.split(/\s+/u).filter(Boolean);

  if (words.length < 8) {
    return {
      quote: SOURCE_QUOTE_FALLBACK,
      contextBefore: "Цитата:",
      contextAfter: excerpt,
    };
  }

  return {
    quote: words.slice(2, Math.min(words.length, 10)).join(" "),
    contextBefore: words.slice(0, 2).join(" "),
    contextAfter: words.slice(10, 18).join(" "),
  };
}

function getPrimarySource(session, salt = 0) {
  const attachments = session.attachments ?? [];

  if (attachments.length === 0) {
    const excerpt = "Фрагмент появится здесь после подключения источников к графу знаний.";

    return {
      nodeId: "source-fallback-1",
      title: "Материалы дела",
      excerpt,
      ...createSourceQuote(excerpt),
    };
  }

  const attachment = attachments[salt % attachments.length];
  const excerpt = attachment.summary ?? "Выдержка из файла будет подставляться из API вместе с привязкой к графу.";

  return {
    attachmentId: attachment.id,
    nodeId: `source-${attachment.id}`,
    title: attachment.fileName ?? attachment.name ?? "Файл",
    excerpt,
    ...createSourceQuote(excerpt),
  };
}

function createDebateMessages(session, hypothesis) {
  const rolesById = new Map((session.debate?.roles ?? []).map((role) => [role.id, role]));
  const messages = [{
    id: `${hypothesis.id}-system`,
    type: "message",
    side: "center",
    agent: {
      id: "system",
      name: "Системный агент",
      variant: "systems",
    },
    text: `${hypothesis.title}: ${hypothesis.description}`,
    source: getPrimarySource(session),
  }];

  Array.from({ length: DEBATE_CYCLE_COUNT }, (_, cycleIndex) => {
    if (cycleIndex > 0) {
      messages.push({
        id: `${hypothesis.id}-cycle-${cycleIndex + 1}`,
        type: "divider",
        label: `${cycleIndex + 1} цикл`,
      });
    }

    DEBATE_ROLE_ORDER.forEach((roleId, roleIndex) => {
      const role = rolesById.get(roleId);

      messages.push({
        id: `${hypothesis.id}-${roleId}-${cycleIndex + 1}`,
        type: "message",
        side: "left",
        agent: role,
        text: createDebateMessageText(roleId, hypothesis, cycleIndex),
        source: getPrimarySource(session, cycleIndex + roleIndex),
      });
    });
  });

  return messages;
}

function createDebateMessageText(roleId, hypothesis, cycleIndex) {
  const cycleLead = cycleIndex === 0
    ? "первично"
    : cycleIndex === 1
      ? "после встречной проверки"
      : "финально";

  if (roleId === "defender") {
    return `Я ${cycleLead} защищаю гипотезу: в ней есть проверяемое ядро и понятный критерий остановки. Сильная сторона - возможность быстро подтвердить эффект на малом масштабе.`;
  }

  if (roleId === "attacker") {
    return `Я ${cycleLead} атакую гипотезу: главный риск в том, что эффект может исчезнуть при переносе в реальные ограничения процесса. Нужно проверить слабое место отдельно.`;
  }

  return `Я ${cycleLead} собираю позицию: ${hypothesis.title.toLowerCase()} можно передавать дальше, если удержать KPI, ограничение ресурсов и источник данных в одном сценарии.`;
}

function createEvaluationMessages(session, targetAgent, hypothesis) {
  const manufacturer = (session.debate?.roles ?? []).find((role) => role.id === "manufacturer");

  return [
    {
      id: `${hypothesis.id}-manufacturer-to-${targetAgent.id}`,
      type: "message",
      side: "right",
      agent: manufacturer,
      text: `Передаю гипотезу на оценку: ${hypothesis.description}`,
      source: getPrimarySource(session),
    },
    {
      id: `${hypothesis.id}-${targetAgent.id}-answer`,
      type: "message",
      side: "left",
      agent: targetAgent,
      text: `Проверяю гипотезу в своей зоне ответственности. Предварительно вижу один сильный аргумент и один риск, который нужно вынести в граф связей.`,
      source: getPrimarySource(session, 1),
    },
  ];
}

function createJudgeMessages(session, hypothesis) {
  const manufacturer = (session.debate?.roles ?? []).find((role) => role.id === "manufacturer");
  const evaluationAgents = session.evaluation?.agents ?? [];

  return [
    {
      id: `${hypothesis.id}-manufacturer-to-judge`,
      type: "message",
      side: "right",
      agent: manufacturer,
      text: `Передаю судье собранную позицию по гипотезе: ${hypothesis.title}. Вердикт не дублирую здесь, он остаётся в основном чате.`,
      source: getPrimarySource(session),
    },
    ...evaluationAgents.map((agent, index) => ({
      id: `${hypothesis.id}-${agent.id}-to-judge`,
      type: "message",
      side: "left",
      agent,
      text: `Моя оценка: гипотеза допустима к следующему шагу только при отдельной проверке риска и подтверждении источников.`,
      source: getPrimarySource(session, index + 1),
    })),
  ];
}

function createHistoryTabs(session, target) {
  const hypotheses = session.hypotheses ?? [];

  return hypotheses.map((hypothesis, index) => ({
    id: hypothesis.id,
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
          <h2 className="agent-history-modal__title">{getAgentDisplayName(target.agent)}</h2>
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
                {tab.title}
              </button>
            ))}
          </div>
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
