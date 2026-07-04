import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";

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
  isDropTargetVisible,
  isAddAgentDisabled,
  isAgentEditingLocked,
  lockedReason,
  activePendingAgentId,
  onOpenPendingAgentSetup,
  onChangePendingAgentSetup,
  onGeneratePendingAgentPrompt,
  isAgentGenerationDisabled,
  onDeletePendingAgentSetup,
  onSavePendingAgentSetup,
  onAddAgent,
}) {
  const itemRefs = useRef(new Map());
  const isClosingSetupRef = useRef(false);
  const [iconPickerAgentId, setIconPickerAgentId] = useState(null);
  const [setupPopoverStyle, setSetupPopoverStyle] = useState({ left: "0px", top: "0px" });
  const sortedAgents = sortAvailableAgents(agents);
  const activePendingAgent =
    sortedAgents.find((agent) =>
      agent.id === activePendingAgentId && (agent.isPendingSetup || !agent.isEmpty),
    ) ?? null;

  const requestCloseSetupPopover = useCallback(() => {
    if (!activePendingAgentId || isClosingSetupRef.current) {
      return;
    }

    isClosingSetupRef.current = true;
    Promise.resolve(onSavePendingAgentSetup(activePendingAgentId)).finally(() => {
      isClosingSetupRef.current = false;
    });
  }, [activePendingAgentId, onSavePendingAgentSetup]);

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

  useEffect(() => {
    isClosingSetupRef.current = false;
  }, [activePendingAgentId]);

  useEffect(() => {
    if (!activePendingAgent) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      requestCloseSetupPopover();
    }

    function handlePointerDown(event) {
      if (event.target instanceof Element && event.target.closest(".agent-setup-popover")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      requestCloseSetupPopover();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handlePointerDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handlePointerDown, true);
    };
  }, [activePendingAgent, requestCloseSetupPopover]);

  function handlePendingAgentClick(agent) {
    if (!agent.isPendingSetup && agent.isEmpty) {
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
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onAddAgent();
        }}
        aria-label={palette.addAgentLabel}
        title={palette.addAgentLabel}
      >
        <Plus aria-hidden="true" strokeWidth={2.1} />
      </button>
      <span className="palette-add-label">{palette.addAgentLabel}</span>
      {isAgentEditingLocked ? (
        <span className="agent-palette__notice">{lockedReason}</span>
      ) : null}

      <div className="palette-list">
        {sortedAgents.map((agent) => {
          const isEditableAgent = agent.isPendingSetup || !agent.isEmpty;
          const isDraggableAgent = !isAgentEditingLocked && !agent.isEmpty && !agent.isPendingSetup;
          const className = [
            "palette-list__item",
            isEditableAgent ? "palette-list__item--editable" : "",
            agent.isPendingSetup ? "palette-list__item--pending" : "",
            isDraggableAgent ? "palette-list__item--draggable" : "",
          ].filter(Boolean).join(" ");

          return (
            <div
              key={agent.id}
              ref={(node) => setItemRef(agent.id, node)}
              className={className}
              style={{ viewTransitionName: getAgentViewTransitionName(agent.id) }}
              role={isEditableAgent ? "button" : undefined}
              tabIndex={isEditableAgent ? 0 : undefined}
              draggable={isDraggableAgent}
              onClick={() => handlePendingAgentClick(agent)}
              onKeyDown={(event) => handlePendingAgentKeyDown(event, agent)}
              onDragStart={(event) => onAgentDragStart(event, "palette", agent.id)}
              onDragEnd={onAgentDragEnd}
            >
              <AgentAvatar variant={agent.variant} size="regular" />
              <span className="palette-list__label">{agent.name}</span>
            </div>
          );
        })}
      </div>
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
              isGenerateDisabled={isAgentGenerationDisabled}
              onDelete={onDeletePendingAgentSetup}
              onSave={onSavePendingAgentSetup}
              style={setupPopoverStyle}
            />,
            document.body,
          )
        : null}
    </aside>
  );
}
