import { AgentCard } from "./AgentCard";
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
  onAgentAvatarRef,
  judgeAvatarRef,
  onAgentDragStart,
  onAgentDragEnd,
  onDropAgent,
  isDropTargetVisible,
}) {
  const { leftAgents, rightAgents } = splitAgentsAroundCenter(evaluation.agents, evaluation.layoutBias);
  const leftSideCount = leftAgents.length + (isDropTargetVisible ? 1 : 0);
  const rightSideCount = rightAgents.length + (isDropTargetVisible ? 1 : 0);
  const sideSlotCount = Math.max(leftSideCount, rightSideCount, 1);
  const sideWidth = (sideSlotCount * EVALUATION_AGENT_SLOT_WIDTH) - EVALUATION_AGENT_GAP;

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event, side) {
    event.preventDefault();
    event.stopPropagation();
    onDropAgent(event, side);
  }

  return (
    <section className="evaluation-stage" aria-label="Оценка гипотезы">
      <div
        className="evaluation-stage__agents"
        onDragOver={handleDragOver}
        aria-label="Перетащите сюда оценочного агента"
      >
        <div
          className="evaluation-stage__rail"
          style={{ "--evaluation-side-width": `${sideWidth}px` }}
        >
          <div
            className="evaluation-stage__side evaluation-stage__side--left"
            onDragOver={handleDragOver}
            onDrop={(event) => handleDrop(event, EVALUATION_SIDE_LEFT)}
            aria-label="Добавить агента слева"
          >
            {isDropTargetVisible ? (
              <div className="agent-drop-slot" aria-hidden="true" />
            ) : null}
            {leftAgents.map((agent) => (
              <div
                key={agent.id}
                className="evaluation-stage__slot"
                style={{ viewTransitionName: getAgentViewTransitionName(agent.id) }}
              >
                <AgentCard
                  {...agent}
                  compact
                  draggable
                  avatarRef={(node) => onAgentAvatarRef(agent.id, node)}
                  onDragStart={(event) => onAgentDragStart(event, "evaluation", agent.id)}
                  onDragEnd={onAgentDragEnd}
                />
              </div>
            ))}
          </div>
          <div className="evaluation-stage__center-lane" aria-hidden="true" />
          <div
            className="evaluation-stage__side evaluation-stage__side--right"
            onDragOver={handleDragOver}
            onDrop={(event) => handleDrop(event, EVALUATION_SIDE_RIGHT)}
            aria-label="Добавить агента справа"
          >
            {rightAgents.map((agent) => (
              <div
                key={agent.id}
                className="evaluation-stage__slot"
                style={{ viewTransitionName: getAgentViewTransitionName(agent.id) }}
              >
                <AgentCard
                  {...agent}
                  compact
                  draggable
                  avatarRef={(node) => onAgentAvatarRef(agent.id, node)}
                  onDragStart={(event) => onAgentDragStart(event, "evaluation", agent.id)}
                  onDragEnd={onAgentDragEnd}
                />
              </div>
            ))}
            {isDropTargetVisible ? (
              <div className="agent-drop-slot" aria-hidden="true" />
            ) : null}
          </div>
          {evaluation.agents.length === 0 && !isDropTargetVisible ? (
            <div className="evaluation-stage__empty">Перетащите агента для оценки</div>
          ) : null}
        </div>
      </div>

      <div className="evaluation-stage__judge">
        <AgentCard {...evaluation.judge} compact avatarRef={judgeAvatarRef} />
      </div>
    </section>
  );
}
