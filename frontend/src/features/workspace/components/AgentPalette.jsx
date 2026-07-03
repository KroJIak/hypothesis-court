import { Plus } from "lucide-react";

import { AgentAvatar } from "./AgentAvatar";
import { sortAvailableAgents } from "../model/workspaceSessionModel";
import { readAgentDragPayload } from "../utils/dragPayload";
import { getAgentViewTransitionName } from "../utils/layoutTransition";

export function AgentPalette({
  palette,
  agents,
  onAgentDragStart,
  onAgentDragEnd,
  onDropAgentToPalette,
  onReorderPaletteAgent,
  isDropTargetVisible,
  isAddAgentDisabled,
  isAgentEditingLocked,
  lockedReason,
  onAddAgent,
}) {
  const sortedAgents = sortAvailableAgents(agents);

  function handleDragOver(event) {
    if (isAgentEditingLocked) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handlePaletteItemDragOver(event, agent) {
    if (isAgentEditingLocked || agent.isEmpty) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handlePaletteItemDrop(event, targetAgent) {
    const payload = readAgentDragPayload(event);

    if (isAgentEditingLocked || payload?.source !== "palette" || targetAgent.isEmpty) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const itemRect = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY > itemRect.top + itemRect.height / 2 ? "after" : "before";

    onReorderPaletteAgent(payload.agentId, targetAgent.id, placement);
  }

  return (
    <aside
      className={`agent-palette${isDropTargetVisible ? " agent-palette--drop-ready" : ""}`}
      onDragOver={handleDragOver}
      onDrop={onDropAgentToPalette}
      aria-label="Доступные агенты"
    >
      <h2 className="agent-palette__title">Агенты</h2>
      <button
        type="button"
        className="palette-add-button"
        disabled={isAddAgentDisabled}
        onClick={onAddAgent}
        aria-label={palette.addAgentLabel}
        title={isAgentEditingLocked ? lockedReason : palette.addAgentLabel}
      >
        <Plus aria-hidden="true" strokeWidth={2.1} />
      </button>
      <span className="palette-add-label">{palette.addAgentLabel}</span>
      {isAgentEditingLocked ? (
        <span className="agent-palette__notice">{lockedReason}</span>
      ) : null}

      <div className="palette-list">
        {sortedAgents.map((agent) => (
          <div
            key={agent.id}
            className={
              agent.isEmpty
                ? "palette-list__item"
                : "palette-list__item palette-list__item--draggable"
            }
            style={{ viewTransitionName: getAgentViewTransitionName(agent.id) }}
            draggable={!isAgentEditingLocked && !agent.isEmpty}
            onDragStart={(event) => onAgentDragStart(event, "palette", agent.id)}
            onDragEnd={onAgentDragEnd}
            onDragOver={(event) => handlePaletteItemDragOver(event, agent)}
            onDrop={(event) => handlePaletteItemDrop(event, agent)}
          >
            <AgentAvatar variant={agent.variant} size="regular" />
            <span className="palette-list__label">{agent.name}</span>
          </div>
        ))}
        {sortedAgents.length === 0 && !isDropTargetVisible ? (
          <span className="palette-list__empty">Все агенты на сцене</span>
        ) : null}
      </div>
    </aside>
  );
}
