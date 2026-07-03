import { Plus } from "lucide-react";

import { AgentAvatar } from "./AgentAvatar";
import { sortAvailableAgents } from "../model/workspaceSessionModel";
import { getAgentViewTransitionName } from "../utils/layoutTransition";

export function AgentPalette({
  palette,
  agents,
  onAgentDragStart,
  onAgentDragEnd,
  onDropAgentToPalette,
  isDropTargetVisible,
  isAddAgentDisabled,
  onAddAgent,
}) {
  const sortedAgents = sortAvailableAgents(agents);

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  return (
    <aside
      className={`agent-palette${isDropTargetVisible ? " agent-palette--drop-ready" : ""}`}
      onDragOver={handleDragOver}
      onDrop={onDropAgentToPalette}
      aria-label="Доступные агенты"
    >
      <button
        type="button"
        className="palette-add-button"
        disabled={isAddAgentDisabled}
        onClick={onAddAgent}
        aria-label={palette.addAgentLabel}
      >
        <Plus aria-hidden="true" strokeWidth={2.1} />
      </button>
      <span className="palette-add-label">{palette.addAgentLabel}</span>

      <div className="palette-list">
        {sortedAgents.map((agent) => (
          <div
            key={agent.id}
            className="palette-list__item palette-list__item--draggable"
            style={{ viewTransitionName: getAgentViewTransitionName(agent.id) }}
            draggable
            onDragStart={(event) => onAgentDragStart(event, "palette", agent.id)}
            onDragEnd={onAgentDragEnd}
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
