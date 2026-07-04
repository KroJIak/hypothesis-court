import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2 } from "lucide-react";

import { AgentAvatar } from "./AgentAvatar";
import { AgentSetupPopover } from "./AgentSetupPopover";
import { sortAvailableAgents } from "../model/workspaceSessionModel";
import { readAgentDragPayload } from "../utils/dragPayload";
import { clampNumber } from "../utils/format";
import { getAgentViewTransitionName } from "../utils/layoutTransition";

const AGENT_SETUP_POPOVER_WIDTH = 328;
const AGENT_SETUP_POPOVER_GAP = 14;
const AGENT_SETUP_POPOVER_EDGE_OFFSET = 12;

export function AgentPalette({
  palette,
  agents,
  onAgentDragStart,
  onAgentDragEnd,
  onDropAgentToPalette,
  onReorderPaletteAgent,
  onDeleteCustomAgent,
  isDropTargetVisible,
  isDeleteTargetVisible,
  isAddAgentDisabled,
  isAgentEditingLocked,
  lockedReason,
  activePendingAgentId,
  onOpenPendingAgentSetup,
  onClosePendingAgentSetup,
  onChangePendingAgentSetup,
  onGeneratePendingAgentPrompt,
  onSavePendingAgentSetup,
  onAddAgent,
}) {
  const itemRefs = useRef(new Map());
  const [iconPickerAgentId, setIconPickerAgentId] = useState(null);
  const [setupPopoverStyle, setSetupPopoverStyle] = useState({ left: "0px", top: "0px" });
  const sortedAgents = sortAvailableAgents(agents);
  const activePendingAgent =
    sortedAgents.find((agent) => agent.id === activePendingAgentId && agent.isPendingSetup) ?? null;

  const setItemRef = useCallback((agentId, node) => {
    if (node) {
      itemRefs.current.set(agentId, node);
      return;
    }

    itemRefs.current.delete(agentId);
  }, []);

  const updateSetupPopoverPosition = useCallback(() => {
    const sourceElement = activePendingAgentId ? itemRefs.current.get(activePendingAgentId) : null;

    if (!sourceElement) {
      return;
    }

    const sourceRect = sourceElement.getBoundingClientRect();
    const left = clampNumber(
      sourceRect.left - AGENT_SETUP_POPOVER_WIDTH - AGENT_SETUP_POPOVER_GAP,
      AGENT_SETUP_POPOVER_EDGE_OFFSET,
      window.innerWidth - AGENT_SETUP_POPOVER_WIDTH - AGENT_SETUP_POPOVER_EDGE_OFFSET,
    );
    const top = clampNumber(
      sourceRect.top,
      AGENT_SETUP_POPOVER_EDGE_OFFSET,
      window.innerHeight - AGENT_SETUP_POPOVER_EDGE_OFFSET,
    );

    setSetupPopoverStyle({
      left: `${left}px`,
      top: `${top}px`,
    });
  }, [activePendingAgentId]);

  useEffect(() => {
    if (!activePendingAgent) {
      return undefined;
    }

    updateSetupPopoverPosition();
    const animationFrameId = window.requestAnimationFrame(updateSetupPopoverPosition);
    window.addEventListener("resize", updateSetupPopoverPosition);
    window.addEventListener("scroll", updateSetupPopoverPosition, true);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updateSetupPopoverPosition);
      window.removeEventListener("scroll", updateSetupPopoverPosition, true);
    };
  }, [activePendingAgent, updateSetupPopoverPosition]);

  function handlePendingAgentClick(agent) {
    if (isAgentEditingLocked || !agent.isPendingSetup) {
      return;
    }

    onOpenPendingAgentSetup(agent.id);
  }

  function handlePendingAgentKeyDown(event, agent) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handlePendingAgentClick(agent);
  }

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
    const placement = event.clientX > itemRect.left + itemRect.width / 2 ? "after" : "before";

    onReorderPaletteAgent(payload.agentId, targetAgent.id, placement);
  }

  function handleDeleteDragOver(event) {
    if (!isDeleteTargetVisible) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDeleteDrop(event) {
    if (!isDeleteTargetVisible) {
      return;
    }

    const payload = readAgentDragPayload(event);

    event.preventDefault();
    event.stopPropagation();

    if (!payload?.agentId) {
      return;
    }

    onDeleteCustomAgent(payload.agentId);
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
            ref={(node) => setItemRef(agent.id, node)}
            className={
              agent.isPendingSetup
                ? "palette-list__item palette-list__item--pending"
                : agent.isEmpty
                  ? "palette-list__item"
                : "palette-list__item palette-list__item--draggable"
            }
            style={{ viewTransitionName: getAgentViewTransitionName(agent.id) }}
            role={agent.isPendingSetup && !isAgentEditingLocked ? "button" : undefined}
            tabIndex={agent.isPendingSetup && !isAgentEditingLocked ? 0 : undefined}
            draggable={!isAgentEditingLocked && !agent.isEmpty && !agent.isPendingSetup}
            onClick={() => handlePendingAgentClick(agent)}
            onKeyDown={(event) => handlePendingAgentKeyDown(event, agent)}
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
      {isDeleteTargetVisible ? (
        <div
          className="agent-palette-trash"
          role="button"
          tabIndex={-1}
          aria-label="Удалить созданного агента"
          onDragOver={handleDeleteDragOver}
          onDrop={handleDeleteDrop}
        >
          <Trash2 aria-hidden="true" strokeWidth={1.9} />
        </div>
      ) : null}
      {activePendingAgent && typeof document !== "undefined"
        ? createPortal(
            <AgentSetupPopover
              agent={activePendingAgent}
              isIconPickerOpen={iconPickerAgentId === activePendingAgent.id}
              onToggleIconPicker={(nextOpen) => {
                setIconPickerAgentId((currentAgentId) => {
                  if (typeof nextOpen === "boolean") {
                    return nextOpen ? activePendingAgent.id : null;
                  }

                  return currentAgentId === activePendingAgent.id ? null : activePendingAgent.id;
                });
              }}
              onChange={onChangePendingAgentSetup}
              onGeneratePrompt={onGeneratePendingAgentPrompt}
              onSave={onSavePendingAgentSetup}
              onClose={() => {
                setIconPickerAgentId(null);
                onClosePendingAgentSetup();
              }}
              style={setupPopoverStyle}
            />,
            document.body,
          )
        : null}
    </aside>
  );
}
