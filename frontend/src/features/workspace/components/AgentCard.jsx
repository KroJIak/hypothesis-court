import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AgentAvatar } from "./AgentAvatar";
import {
  AGENT_TOOLTIP_EDGE_OFFSET,
  AGENT_TOOLTIP_GAP,
} from "../constants";
import { capitalizeFirst, clampNumber } from "../utils/format";

export function AgentCard({
  name,
  status,
  variant,
  compact = false,
  avatarRef = null,
  draggable = false,
  hideStatus = false,
  onDragStart,
  onDragEnd,
}) {
  const localAvatarRef = useRef(null);
  const [isNameVisible, setIsNameVisible] = useState(false);
  const [nameTooltipStyle, setNameTooltipStyle] = useState({ left: "0px", top: "0px" });

  const setAvatarAnchorRef = useCallback((node) => {
    localAvatarRef.current = node;

    if (typeof avatarRef === "function") {
      avatarRef(node);
      return;
    }

    if (avatarRef) {
      avatarRef.current = node;
    }
  }, [avatarRef]);

  const updateNameTooltip = useCallback(() => {
    const avatarElement = localAvatarRef.current;

    if (!avatarElement) {
      return;
    }

    const avatarRect = avatarElement.getBoundingClientRect();
    const tooltipLeft = clampNumber(
      avatarRect.left + avatarRect.width / 2,
      AGENT_TOOLTIP_EDGE_OFFSET,
      window.innerWidth - AGENT_TOOLTIP_EDGE_OFFSET,
    );
    const tooltipTop = Math.max(avatarRect.top - AGENT_TOOLTIP_GAP, AGENT_TOOLTIP_EDGE_OFFSET);

    setNameTooltipStyle({
      left: `${tooltipLeft}px`,
      top: `${tooltipTop}px`,
    });
  }, []);

  const showNameTooltip = useCallback(() => {
    setIsNameVisible(true);
    window.requestAnimationFrame(updateNameTooltip);
  }, [updateNameTooltip]);

  const hideNameTooltip = useCallback(() => {
    setIsNameVisible(false);
  }, []);

  useEffect(() => {
    if (!isNameVisible) {
      return undefined;
    }

    window.addEventListener("scroll", hideNameTooltip, true);
    window.addEventListener("resize", hideNameTooltip);

    return () => {
      window.removeEventListener("scroll", hideNameTooltip, true);
      window.removeEventListener("resize", hideNameTooltip);
    };
  }, [hideNameTooltip, isNameVisible]);

  return (
    <div
      className={`scene-agent${compact ? " scene-agent--compact" : ""}${draggable ? " scene-agent--draggable" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={showNameTooltip}
      onMouseLeave={hideNameTooltip}
      onFocus={showNameTooltip}
      onBlur={hideNameTooltip}
    >
      <span className="scene-agent__avatar-anchor" ref={setAvatarAnchorRef}>
        <AgentAvatar variant={variant} size={compact ? "compact" : "regular"} />
      </span>
      {isNameVisible && typeof document !== "undefined"
        ? createPortal(
            <span className="scene-agent__name" style={nameTooltipStyle}>
              {name}
            </span>,
            document.body,
          )
        : null}
      {status && !hideStatus ? (
        <span className="scene-agent__status">
          {capitalizeFirst(status)}
          <span className="scene-agent__status-tail" aria-hidden="true">...</span>
        </span>
      ) : null}
    </div>
  );
}
