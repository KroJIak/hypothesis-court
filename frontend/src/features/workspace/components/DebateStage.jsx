import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";

import { AgentCard } from "./AgentCard";
import { getElementCenter } from "../utils/geometry";

export function DebateStage({ debate, manufacturerAvatarRef }) {
  const stageRef = useRef(null);
  const topLeftAvatarRef = useRef(null);
  const topRightAvatarRef = useRef(null);
  const bottomAvatarRef = useRef(null);
  const [connectionLayer, setConnectionLayer] = useState({ width: 0, height: 0, paths: [] });
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
          { id: "top-left-top-right", d: `M${topLeft.x.toFixed(1)} ${topLeft.y.toFixed(1)}L${topRight.x.toFixed(1)} ${topRight.y.toFixed(1)}` },
          { id: "top-left-bottom", d: `M${topLeft.x.toFixed(1)} ${topLeft.y.toFixed(1)}L${bottom.x.toFixed(1)} ${bottom.y.toFixed(1)}` },
          { id: "top-right-bottom", d: `M${topRight.x.toFixed(1)} ${topRight.y.toFixed(1)}L${bottom.x.toFixed(1)} ${bottom.y.toFixed(1)}` },
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
            <path key={path.id} d={path.d} />
          ))}
        </svg>
      ) : null}
      <div className="debate-stage__triangle debate-stage__triangle--left">
        <AgentCard {...rolesByPlacement["top-left"]} avatarRef={topLeftAvatarRef} />
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--center">
        <button type="button" className="play-button" aria-label={debate.playLabel}>
          <span className="play-button__icon"><Play aria-hidden="true" strokeWidth={2.1} /></span>
        </button>
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--right">
        <AgentCard {...rolesByPlacement["top-right"]} avatarRef={topRightAvatarRef} />
      </div>
      <div className="debate-stage__triangle debate-stage__triangle--bottom">
        <AgentCard {...rolesByPlacement["bottom-center"]} avatarRef={setBottomAvatarRef} />
      </div>
    </section>
  );
}
