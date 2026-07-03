import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DebateStage } from "./DebateStage";
import { EvaluationStage } from "./EvaluationStage";
import { HypothesisCandidates } from "./HypothesisCandidates";
import { useScenePlayback } from "../hooks/useScenePlayback";
import { getElementCenter, createStraightPath } from "../utils/geometry";

export function WorkspaceScene({
  session,
  onAgentDragStart,
  onAgentDragEnd,
  onDropAgentToEvaluation,
  dragSource,
  isAgentEditingLocked,
}) {
  const sceneRef = useRef(null);
  const manufacturerAvatarRef = useRef(null);
  const judgeAvatarRef = useRef(null);
  const evaluationAvatarRefs = useRef(new Map());
  const [connectionLayer, setConnectionLayer] = useState({ width: 0, height: 0, paths: [] });
  const {
    activeDebateConnectionDirections,
    activeEvaluationConnectionDirections,
    debateRoleStatuses,
    evaluationAgentStatuses,
    hypotheses,
    isAnswerVisible,
    judgeStatus,
  } = useScenePlayback(session);
  const hasHypotheses = (session.hypotheses ?? []).length > 0;
  const isHypothesesLoading = session.isStarted
    && (session.launchedRequests ?? []).length > 0
    && !hasHypotheses;
  const debate = useMemo(() => ({
    ...session.debate,
    roles: session.debate.roles.map((role) => ({
      ...role,
      status: debateRoleStatuses[role.id] ?? "",
    })),
  }), [debateRoleStatuses, session.debate]);
  const evaluation = useMemo(() => ({
    ...session.evaluation,
    agents: session.evaluation.agents.map((agent) => ({
      ...agent,
      status: evaluationAgentStatuses[agent.id] ?? "",
    })),
    judge: {
      ...session.evaluation.judge,
      status: judgeStatus,
    },
  }), [evaluationAgentStatuses, judgeStatus, session.evaluation]);

  const setEvaluationAvatarRef = useCallback((agentId, node) => {
    if (node) {
      evaluationAvatarRefs.current.set(agentId, node);
      return;
    }

    evaluationAvatarRefs.current.delete(agentId);
  }, []);

  function getEvaluationConnectionClassName(connectionId) {
    const direction = activeEvaluationConnectionDirections.get(connectionId);

    if (!direction) {
      return "connection-path";
    }

    return direction === "reverse"
      ? "connection-path connection-path--active connection-path--reverse"
      : "connection-path connection-path--active";
  }

  useLayoutEffect(() => {
    const scrollContainer = sceneRef.current?.parentElement;

    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [session.id]);

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
    <div className={`workspace-scene${hasHypotheses ? "" : " workspace-scene--empty"}`} ref={sceneRef}>
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
              className={getEvaluationConnectionClassName(path.id)}
              d={path.d}
            />
          ))}
        </svg>
      ) : null}

      <HypothesisCandidates hypotheses={hypotheses} isLoading={isHypothesesLoading} />
      <DebateStage
        debate={debate}
        manufacturerAvatarRef={manufacturerAvatarRef}
        activeConnectionDirections={activeDebateConnectionDirections}
        hideAgentStatus={!hasHypotheses}
      />
      <EvaluationStage
        evaluation={evaluation}
        sessionId={session.id}
        answer={session.answer}
        isAnswerVisible={isAnswerVisible}
        hideAgentStatus={!hasHypotheses}
        onAgentAvatarRef={setEvaluationAvatarRef}
        judgeAvatarRef={judgeAvatarRef}
        onAgentDragStart={onAgentDragStart}
        onAgentDragEnd={onAgentDragEnd}
        onDropAgent={onDropAgentToEvaluation}
        isDropTargetVisible={!isAgentEditingLocked && dragSource === "palette"}
        isAgentEditingLocked={isAgentEditingLocked}
      />
    </div>
  );
}
