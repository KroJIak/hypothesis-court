import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play } from "lucide-react";

import { AgentCard } from "./AgentCard";
import { getElementCenter } from "../utils/geometry";
import { clampNumber } from "../utils/format";

const PLAY_TOOLTIP_EDGE_OFFSET = 16;
const PLAY_TOOLTIP_GAP = 8;

export function DebateStage({
  debate,
  manufacturerAvatarRef,
  activeConnectionDirections,
  hideAgentStatus,
}) {
  const stageRef = useRef(null);
  const topLeftAvatarRef = useRef(null);
  const topRightAvatarRef = useRef(null);
  const bottomAvatarRef = useRef(null);
  const playButtonRef = useRef(null);
  const [connectionLayer, setConnectionLayer] = useState({ width: 0, height: 0, paths: [] });
  const [isPlayTooltipVisible, setIsPlayTooltipVisible] = useState(false);
  const [playTooltipStyle, setPlayTooltipStyle] = useState({ left: "0px", top: "0px" });
  const rolesByPlacement = useMemo(() => {
    return debate.roles.reduce((accumulator, role) => {
      accumulator[role.placement] = role;
      return accumulator;
    }, {});
  }, [debate.roles]);

  const setBottomAvatarRef = useCallback((node) => {
    bottomAvatarRef.current = node;

    if (manufacturerAvatarRef) {
      manufacturerAvatarRef.current = node;
    }
  }, [manufacturerAvatarRef]);

  function getConnectionClassName(connectionId) {
    if (!activeConnectionDirections.has(connectionId)) {
      return "connection-path";
    }

    return "connection-path connection-path--active";
  }

  const updatePlayTooltipPosition = useCallback(() => {
    const buttonElement = playButtonRef.current;

    if (!buttonElement) {
      return;
    }

    const buttonRect = buttonElement.getBoundingClientRect();
    const tooltipLeft = clampNumber(
      buttonRect.left + buttonRect.width / 2,
      PLAY_TOOLTIP_EDGE_OFFSET,
      window.innerWidth - PLAY_TOOLTIP_EDGE_OFFSET,
    );
    const tooltipTop = clampNumber(
      buttonRect.bottom + PLAY_TOOLTIP_GAP,
      PLAY_TOOLTIP_EDGE_OFFSET,
      window.innerHeight - PLAY_TOOLTIP_EDGE_OFFSET,
    );

    setPlayTooltipStyle({
      left: `${tooltipLeft}px`,
      top: `${tooltipTop}px`,
    });
  }, []);

  const showPlayTooltip = useCallback(() => {
    setIsPlayTooltipVisible(true);
    window.requestAnimationFrame(updatePlayTooltipPosition);
  }, [updatePlayTooltipPosition]);

  const hidePlayTooltip = useCallback(() => {
    setIsPlayTooltipVisible(false);
  }, []);

  useEffect(() => {
    if (!isPlayTooltipVisible) {
      return undefined;
    }

    window.addEventListener("scroll", hidePlayTooltip, true);
    window.addEventListener("resize", hidePlayTooltip);

    return () => {
      window.removeEventListener("scroll", hidePlayTooltip, true);
      window.removeEventListener("resize", hidePlayTooltip);
    };
  }, [hidePlayTooltip, isPlayTooltipVisible]);

  useLayoutEffect(() => {
    const updateConnections = () => {
      const stageElement = stageRef.current;
      const topLeftAvatar = topLeftAvatarRef.current;
      const topRightAvatar = topRightAvatarRef.current;
      const bottomAvatar = bottomAvatarRef.current;

      if (!stageElement || !topLeftAvatar || !topRightAvatar || !bottomAvatar) {
        setConnectionLayer({ width: 0, height: 0, paths: [] });
        return;
      }

      const stageRect = stageElement.getBoundingClientRect();
      const topLeft = getElementCenter(topLeftAvatar, stageRect);
      const topRight = getElementCenter(topRightAvatar, stageRect);
      const bottom = getElementCenter(bottomAvatar, stageRect);

      setConnectionLayer({
        width: stageRect.width,
        height: stageElement.scrollHeight,
        paths: [
          {
            id: "top-left-top-right",
            d: `M${topLeft.x.toFixed(1)} ${topLeft.y.toFixed(1)}L${topRight.x.toFixed(1)} ${topRight.y.toFixed(1)}`,
            reverseD: `M${topRight.x.toFixed(1)} ${topRight.y.toFixed(1)}L${topLeft.x.toFixed(1)} ${topLeft.y.toFixed(1)}`,
          },
          {
            id: "top-left-bottom",
            d: `M${topLeft.x.toFixed(1)} ${topLeft.y.toFixed(1)}L${bottom.x.toFixed(1)} ${bottom.y.toFixed(1)}`,
            reverseD: `M${bottom.x.toFixed(1)} ${bottom.y.toFixed(1)}L${topLeft.x.toFixed(1)} ${topLeft.y.toFixed(1)}`,
          },
          {
            id: "top-right-bottom",
            d: `M${topRight.x.toFixed(1)} ${topRight.y.toFixed(1)}L${bottom.x.toFixed(1)} ${bottom.y.toFixed(1)}`,
            reverseD: `M${bottom.x.toFixed(1)} ${bottom.y.toFixed(1)}L${topRight.x.toFixed(1)} ${topRight.y.toFixed(1)}`,
          },
        ],
      });
    };

    updateConnections();

    const animationFrame = window.requestAnimationFrame(updateConnections);
    const resizeObserver = new ResizeObserver(updateConnections);
    const observedElements = [
      stageRef.current,
      topLeftAvatarRef.current,
      topRightAvatarRef.current,
      bottomAvatarRef.current,
    ].filter(Boolean);

    observedElements.forEach((element) => resizeObserver.observe(element));
    window.addEventListener("resize", updateConnections);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateConnections);
    };
  }, []);

  return (
    <section className="debate-stage" ref={stageRef} aria-label="Дискуссия агентов">
      {connectionLayer.paths.length > 0 ? (
        <svg
          className="debate-stage__links"
          style={{ width: `${connectionLayer.width}px`, height: `${connectionLayer.height}px` }}
          viewBox={`0 0 ${connectionLayer.width} ${connectionLayer.height}`}
          aria-hidden="true"
        >
          {connectionLayer.paths.map((path) => (
            <path
              key={path.id}
              className={getConnectionClassName(path.id)}
              d={activeConnectionDirections.get(path.id) === "reverse" ? path.reverseD : path.d}
            />
          ))}
        </svg>
      ) : null}
      <div className="debate-stage__triangle debate-stage__triangle--left">
        <AgentCard {...rolesByPlacement["top-left"]} hideStatus={hideAgentStatus} avatarRef={topLeftAvatarRef} />
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--center">
        <button
          ref={playButtonRef}
          type="button"
          className="play-button"
          aria-label={debate.playLabel}
          onMouseEnter={showPlayTooltip}
          onMouseLeave={hidePlayTooltip}
          onFocus={showPlayTooltip}
          onBlur={hidePlayTooltip}
        >
          <span className="play-button__icon"><Play aria-hidden="true" strokeWidth={2.1} /></span>
        </button>
        {isPlayTooltipVisible && typeof document !== "undefined"
          ? createPortal(
              <span className="play-button__tooltip" style={playTooltipStyle}>
                {debate.playLabel}
              </span>,
              document.body,
            )
          : null}
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--right">
        <AgentCard {...rolesByPlacement["top-right"]} hideStatus={hideAgentStatus} avatarRef={topRightAvatarRef} />
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--bottom">
        <AgentCard {...rolesByPlacement["bottom-center"]} hideStatus={hideAgentStatus} avatarRef={setBottomAvatarRef} />
      </div>
    </section>
  );
}
