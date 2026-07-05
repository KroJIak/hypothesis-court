import { Fragment, useState } from "react";

import { AgentCard } from "./AgentCard";
import { JudgeVerdict } from "./JudgeVerdict";
import { JudgeVerdictActions } from "./JudgeVerdictActions";
import {
  EVALUATION_AGENT_GAP,
  EVALUATION_AGENT_SLOT_WIDTH,
  EVALUATION_SIDE_LEFT,
  EVALUATION_SIDE_RIGHT,
} from "../constants";
import { splitAgentsAroundCenter } from "../model/workspaceSessionModel";
import { getAgentViewTransitionName } from "../utils/layoutTransition";

export function EvaluationStage({
  evaluation,
  sessionId,
  answer,
  verdict,
  hypotheses = [],
  consultationMessages = [],
  isAnswerVisible,
  isVerdictTypewriterReady,
  shouldAnimateVerdict,
  hideAgentStatus,
  onVerdictComplete,
  onAgentAvatarRef,
  judgeAvatarRef,
  onAgentDragStart,
  onAgentDragEnd,
  onDropAgent,
  isDropTargetVisible,
  isAgentEditingLocked,
  onOpenAgentHistory,
  verdictActions,
}) {
  const [activeDropIntent, setActiveDropIntent] = useState(null);
  const { leftAgents, rightAgents } = splitAgentsAroundCenter(evaluation.agents, evaluation.layoutBias);
  const activeDropSide = activeDropIntent?.side ?? null;
  const hasDropPreview = isDropTargetVisible && !isAgentEditingLocked;
  const leftSideCount = leftAgents.length + (activeDropSide === EVALUATION_SIDE_LEFT ? 1 : 0);
  const rightSideCount = rightAgents.length + (activeDropSide === EVALUATION_SIDE_RIGHT ? 1 : 0);
  const sideSlotCount = Math.max(leftSideCount, rightSideCount, 1);
  const sideWidth = (sideSlotCount * EVALUATION_AGENT_SLOT_WIDTH) - EVALUATION_AGENT_GAP;

  function getEdgeDropIntent(event) {
    const dropRect = event.currentTarget.getBoundingClientRect();
    const slotElements = Array.from(event.currentTarget.querySelectorAll(".evaluation-stage__slot"));

    if (slotElements.length === 0) {
      return {
        side: EVALUATION_SIDE_RIGHT,
        index: 0,
      };
    }

    const slotIndex = slotElements.findIndex((slotElement) => {
      const slotRect = slotElement.getBoundingClientRect();

      return event.clientX < slotRect.left + slotRect.width / 2;
    });
    const absoluteIndex = slotIndex === -1 ? slotElements.length : slotIndex;

    if (absoluteIndex <= leftAgents.length) {
      return {
        side: EVALUATION_SIDE_LEFT,
        index: absoluteIndex,
      };
    }

    return {
      side: EVALUATION_SIDE_RIGHT,
      index: absoluteIndex - leftAgents.length,
    };
  }

  function getFallbackEdgeDropIntent(event) {
    const dropRect = event.currentTarget.getBoundingClientRect();
    const edgeActivationWidth = Math.min(
      dropRect.width * 0.36,
      (EVALUATION_AGENT_SLOT_WIDTH + EVALUATION_AGENT_GAP) * 2.4,
    );

    if (event.clientX <= dropRect.left + edgeActivationWidth) {
      return {
        side: EVALUATION_SIDE_LEFT,
        index: 0,
      };
    }

    if (event.clientX >= dropRect.right - edgeActivationWidth) {
      return {
        side: EVALUATION_SIDE_RIGHT,
        index: rightAgents.length,
      };
    }

    return null;
  }

  function handleDragOver(event) {
    if (isAgentEditingLocked) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (isDropTargetVisible) {
      const dropIntent = getEdgeDropIntent(event) ?? getFallbackEdgeDropIntent(event);

      setActiveDropIntent(dropIntent);

      if (dropIntent?.side === EVALUATION_SIDE_LEFT) {
        event.currentTarget.scrollTo({ left: 0, behavior: "smooth" });
      }

      if (dropIntent?.side === EVALUATION_SIDE_RIGHT) {
        event.currentTarget.scrollTo({
          left: event.currentTarget.scrollWidth - event.currentTarget.clientWidth,
          behavior: "smooth",
        });
      }
    }
  }

  function handleDrop(event, dropIntent) {
    event.preventDefault();
    event.stopPropagation();

    if (isAgentEditingLocked || !dropIntent) {
      return;
    }

    const insertionIndex = dropIntent.side === EVALUATION_SIDE_LEFT
      ? dropIntent.index
      : leftAgents.length + dropIntent.index;

    onDropAgent(event, {
      side: dropIntent.side,
      index: insertionIndex,
    });
    setActiveDropIntent(null);
  }

  function handleWideDrop(event) {
    if (!isDropTargetVisible) {
      return;
    }

    handleDrop(event, activeDropIntent ?? getEdgeDropIntent(event) ?? getFallbackEdgeDropIntent(event));
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setActiveDropIntent(null);
    }
  }

  function renderAgentSlot(agent) {
    return (
      <div
        key={agent.id}
        className="evaluation-stage__slot"
        style={{ viewTransitionName: getAgentViewTransitionName(agent.id) }}
      >
        <AgentCard
          {...agent}
          compact
          draggable={!isAgentEditingLocked}
          hideStatus={hideAgentStatus}
          avatarRef={(node) => onAgentAvatarRef(agent.id, node)}
          onDragStart={(event) => onAgentDragStart(event, "evaluation", agent.id)}
          onDragEnd={onAgentDragEnd}
          onClick={() => onOpenAgentHistory?.({
            type: "evaluation",
            agent,
          })}
        />
      </div>
    );
  }

  return (
    <section className="evaluation-stage" aria-label="Оценка гипотезы">
      <div
        className="evaluation-stage__agents"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleWideDrop}
        aria-label="Перетащите сюда оценочного агента"
      >
        <div
          className="evaluation-stage__rail"
          style={{ "--evaluation-side-width": `${sideWidth}px` }}
        >
          <div
            className={
              activeDropSide === EVALUATION_SIDE_LEFT
                ? "evaluation-stage__side evaluation-stage__side--left evaluation-stage__side--drop-active"
                : "evaluation-stage__side evaluation-stage__side--left"
            }
            aria-label="Добавить агента слева"
          >
            {leftAgents.map((agent, index) => (
              <Fragment key={agent.id}>
                {activeDropSide === EVALUATION_SIDE_LEFT && activeDropIntent?.index === index ? (
                  <div className="agent-drop-slot" aria-hidden="true" />
                ) : null}
                {renderAgentSlot(agent)}
              </Fragment>
            ))}
            {activeDropSide === EVALUATION_SIDE_LEFT && activeDropIntent?.index === leftAgents.length ? (
              <div className="agent-drop-slot" aria-hidden="true" />
            ) : null}
          </div>
          <div className="evaluation-stage__center-lane" aria-hidden="true" />
          <div
            className={
              activeDropSide === EVALUATION_SIDE_RIGHT
                ? "evaluation-stage__side evaluation-stage__side--right evaluation-stage__side--drop-active"
                : "evaluation-stage__side evaluation-stage__side--right"
            }
            aria-label="Добавить агента справа"
          >
            {rightAgents.map((agent, index) => (
              <Fragment key={agent.id}>
                {activeDropSide === EVALUATION_SIDE_RIGHT && activeDropIntent?.index === index ? (
                  <div className="agent-drop-slot" aria-hidden="true" />
                ) : null}
                {renderAgentSlot(agent)}
              </Fragment>
            ))}
            {activeDropSide === EVALUATION_SIDE_RIGHT && activeDropIntent?.index === rightAgents.length ? (
              <div className="agent-drop-slot" aria-hidden="true" />
            ) : null}
          </div>
          {evaluation.agents.length === 0 && !isAgentEditingLocked ? (
            <div
              className={
                hasDropPreview
                  ? "evaluation-stage__empty evaluation-stage__empty--drop-ready"
                  : "evaluation-stage__empty"
              }
            >
              Перетащите агента для оценки
            </div>
          ) : null}
        </div>
      </div>

      <div className="evaluation-stage__judge">
        <AgentCard
          {...evaluation.judge}
          compact
          hideStatus={hideAgentStatus}
          avatarRef={judgeAvatarRef}
          onClick={() => onOpenAgentHistory?.({
            type: "judge",
            agent: evaluation.judge,
          })}
        />
      </div>

      {isAnswerVisible && (answer || verdict) ? (
        <>
          <JudgeVerdict
            answer={answer}
            verdict={verdict}
            hypotheses={hypotheses}
            sessionId={sessionId}
            onComplete={onVerdictComplete}
            isReadyToType={isVerdictTypewriterReady}
            shouldAnimate={shouldAnimateVerdict}
          />
          {verdictActions ? <JudgeVerdictActions {...verdictActions} /> : null}
          {consultationMessages.length > 0 ? (
            <div className="consultation-thread" aria-label="Консультация по гипотезам">
              {consultationMessages.map((message) => (
                <div key={message.id} className="consultation-message">
                  <p className="consultation-message__question">{message.question}</p>
                  <p className="consultation-message__answer">{message.answer}</p>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
