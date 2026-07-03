import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { DebateStage } from "./DebateStage";
import { EvaluationStage } from "./EvaluationStage";
import { HypothesisCandidates } from "./HypothesisCandidates";
import { useScenePlayback } from "../hooks/useScenePlayback";
import { getElementCenter, createStraightPath } from "../utils/geometry";

export function WorkspaceScene({ session, onAgentDragStart, onAgentDragEnd, onDropAgentToEvaluation, dragSource }) {
  const sceneRef = useRef(null);
  const manufacturerAvatarRef = useRef(null);
  const judgeAvatarRef = useRef(null);
  const evaluationAvatarRefs = useRef(new Map());
  const [connectionLayer, setConnectionLayer] = useState({ width: 0, height: 0, paths: [] });
  const {
    activeDebateConnectionIds,
    activeEvaluationConnectionIds,
    isAnswerVisible,
    isRunning,
    startPlayback,
  } = useScenePlayback(session);

  const setEvaluationAvatarRef = useCallback((agentId, node) => {
    if (node) {
      evaluationAvatarRefs.current.set(agentId, node);
      return;
    }

    evaluationAvatarRefs.current.delete(agentId);
  }, []);

  useLayoutEffect(() => {
    const updateConnections = () => {
      const sceneElement = sceneRef.current;
      const manufacturerAvatar = manufacturerAvatarRef.current;

      if (!sceneElement || !manufacturerAvatar) {
        setConnectionLayer({ width: 0, height: 0, paths: [] });
        return;
      }

      const sceneRect = sceneElement.getBoundingClientRect();
      const manufacturerSource = getElementCenter(manufacturerAvatar, sceneRect);
      const judgeAvatar = judgeAvatarRef.current;
      const judgeTarget = judgeAvatar ? getElementCenter(judgeAvatar, sceneRect) : null;
      const agentPaths = session.evaluation.agents
        .flatMap((agent) => {
          const targetElement = evaluationAvatarRefs.current.get(agent.id);

          if (!targetElement) {
            return [];
          }

          const agentCenter = getElementCenter(targetElement, sceneRect);
          const agentConnections = [{
            id: `manufacturer-${agent.id}`,
            d: createStraightPath(manufacturerSource, agentCenter),
          }];

          if (judgeTarget) {
            agentConnections.push({
              id: `${agent.id}-judge`,
              d: createStraightPath(agentCenter, judgeTarget),
            });
          }

          return agentConnections;
        });
      const directJudgePath = judgeTarget
        ? {
            id: "manufacturer-judge",
            d: createStraightPath(manufacturerSource, judgeTarget),
          }
        : null;
      const paths = directJudgePath ? [directJudgePath, ...agentPaths] : agentPaths;

      setConnectionLayer({
        width: sceneRect.width,
        height: sceneElement.scrollHeight,
        paths,
      });
    };

    updateConnections();

    const animationFrame = window.requestAnimationFrame(updateConnections);
    const resizeObserver = new ResizeObserver(updateConnections);
    const observedElements = [
      sceneRef.current,
      manufacturerAvatarRef.current,
      judgeAvatarRef.current,
      ...session.evaluation.agents.map((agent) => evaluationAvatarRefs.current.get(agent.id)),
    ].filter(Boolean);

    observedElements.forEach((element) => resizeObserver.observe(element));
    window.addEventListener("resize", updateConnections);
    sceneRef.current?.addEventListener("scroll", updateConnections, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateConnections);
      sceneRef.current?.removeEventListener("scroll", updateConnections, true);
    };
  }, [session.evaluation.agents]);

  return (
    <div className="workspace-scene" ref={sceneRef}>
      {connectionLayer.paths.length > 0 ? (
        <svg
          className="workspace-scene__connection-layer"
          style={{ width: `${connectionLayer.width}px`, height: `${connectionLayer.height}px` }}
          viewBox={`0 0 ${connectionLayer.width} ${connectionLayer.height}`}
          aria-hidden="true"
        >
          {connectionLayer.paths.map((path) => (
            <path
              key={path.id}
              className={activeEvaluationConnectionIds.has(path.id) ? "connection-path connection-path--active" : "connection-path"}
              d={path.d}
            />
          ))}
        </svg>
      ) : null}

      <HypothesisCandidates hypotheses={session.hypotheses ?? []} />
      <DebateStage
        debate={session.debate}
        manufacturerAvatarRef={manufacturerAvatarRef}
        activeConnectionIds={activeDebateConnectionIds}
        isPlaybackRunning={isRunning}
        onPlay={startPlayback}
      />
      <EvaluationStage
        evaluation={session.evaluation}
        answer={session.answer}
        isAnswerVisible={isAnswerVisible}
        onAgentAvatarRef={setEvaluationAvatarRef}
        judgeAvatarRef={judgeAvatarRef}
        onAgentDragStart={onAgentDragStart}
        onAgentDragEnd={onAgentDragEnd}
        onDropAgent={onDropAgentToEvaluation}
        isDropTargetVisible={dragSource === "palette"}
      />
    </div>
  );
}
