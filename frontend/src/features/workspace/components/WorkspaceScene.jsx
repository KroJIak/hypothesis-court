import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DebateStage } from "./DebateStage";
import { EvaluationStage } from "./EvaluationStage";
import { HypothesisCandidates } from "./HypothesisCandidates";
import { useScenePlayback } from "../hooks/useScenePlayback";
import { getElementCenter, createStraightPath } from "../utils/geometry";

const VERDICT_SCROLL_SETTLE_MS = 260;

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function WorkspaceScene({
  session,
  onAgentDragStart,
  onAgentDragEnd,
  onDropAgentToEvaluation,
  dragSource,
  isAgentEditingLocked,
  onVerdictComplete,
  onOpenAgentHistory,
  onOpenKnowledgeGraph,
  verdictActions,
}) {
  const sceneRef = useRef(null);
  const manufacturerAvatarRef = useRef(null);
  const judgeAvatarRef = useRef(null);
  const evaluationAvatarRefs = useRef(new Map());
  const verdictScrollSpacerRef = useRef(null);
  const verdictScrollFrameRef = useRef(null);
  const verdictScrollTimeoutRef = useRef(null);
  const [preparedVerdictScrollKey, setPreparedVerdictScrollKey] = useState(null);
  const [verdictScrollSpacerHeight, setVerdictScrollSpacerHeight] = useState(0);
  const [connectionLayer, setConnectionLayer] = useState({ width: 0, height: 0, paths: [] });
  const {
    activeDebateConnectionDirections,
    activeEvaluationConnectionDirections,
    debateCycleNumber,
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
  const answerRevealScrollKey = `${session.id}:${session.answer ?? ""}`;
  const isVerdictTypewriterReady = !isAnswerVisible || preparedVerdictScrollKey === answerRevealScrollKey;
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
      const evaluationViewport = sceneElement.querySelector(".evaluation-stage__agents");
      const evaluationViewportRect = evaluationViewport?.getBoundingClientRect();
      const evaluationMinX = evaluationViewportRect ? evaluationViewportRect.left - sceneRect.left : 0;
      const evaluationMaxX = evaluationViewportRect ? evaluationViewportRect.right - sceneRect.left : sceneRect.width;
      const agentPaths = session.evaluation.agents
        .flatMap((agent) => {
          const targetElement = evaluationAvatarRefs.current.get(agent.id);

          if (!targetElement) {
            return [];
          }

          const rawAgentCenter = getElementCenter(targetElement, sceneRect);
          const agentCenter = {
            ...rawAgentCenter,
            x: clampNumber(rawAgentCenter.x, evaluationMinX + 2, evaluationMaxX - 2),
          };
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

  useLayoutEffect(() => {
    function clearPendingScroll() {
      if (verdictScrollFrameRef.current) {
        window.cancelAnimationFrame(verdictScrollFrameRef.current);
        verdictScrollFrameRef.current = null;
      }

      if (verdictScrollTimeoutRef.current) {
        window.clearTimeout(verdictScrollTimeoutRef.current);
        verdictScrollTimeoutRef.current = null;
      }
    }

    function getScrollGeometry() {
      const sceneElement = sceneRef.current;
      const judgeAvatarElement = judgeAvatarRef.current;
      const scrollContainer = sceneElement?.parentElement;

      if (!sceneElement || !judgeAvatarElement || !scrollContainer) {
        return null;
      }

      const containerRect = scrollContainer.getBoundingClientRect();
      const judgeAvatarRect = judgeAvatarElement.getBoundingClientRect();
      const spacerHeight = verdictScrollSpacerRef.current?.offsetHeight ?? 0;
      const targetScrollTop = scrollContainer.scrollTop + judgeAvatarRect.top - containerRect.top;
      const naturalMaxScrollTop = Math.max(
        0,
        scrollContainer.scrollHeight - spacerHeight - scrollContainer.clientHeight,
      );

      return {
        scrollContainer,
        targetScrollTop,
        requiredSpacerHeight: Math.ceil(Math.max(0, targetScrollTop - naturalMaxScrollTop)),
      };
    }

    clearPendingScroll();

    if (!isAnswerVisible || !session.answer) {
      setPreparedVerdictScrollKey(null);
      setVerdictScrollSpacerHeight(0);
      return;
    }

    if (preparedVerdictScrollKey === answerRevealScrollKey) {
      return;
    }

    setPreparedVerdictScrollKey(null);

    const initialGeometry = getScrollGeometry();

    if (!initialGeometry) {
      setPreparedVerdictScrollKey(answerRevealScrollKey);
      return;
    }

    setVerdictScrollSpacerHeight(initialGeometry.requiredSpacerHeight);

    verdictScrollFrameRef.current = window.requestAnimationFrame(() => {
      const scrollGeometry = getScrollGeometry();

      if (!scrollGeometry) {
        setPreparedVerdictScrollKey(answerRevealScrollKey);
        return;
      }

      const maxScrollTop = Math.max(0, scrollGeometry.scrollContainer.scrollHeight - scrollGeometry.scrollContainer.clientHeight);
      const nextScrollTop = clampNumber(scrollGeometry.targetScrollTop, 0, maxScrollTop);
      const shouldAnimateScroll = Math.abs(scrollGeometry.scrollContainer.scrollTop - nextScrollTop) > 1;

      scrollGeometry.scrollContainer.scrollTo({
        top: nextScrollTop,
        behavior: shouldAnimateScroll ? "smooth" : "auto",
      });

      verdictScrollTimeoutRef.current = window.setTimeout(() => {
        setPreparedVerdictScrollKey(answerRevealScrollKey);
        verdictScrollTimeoutRef.current = null;
      }, shouldAnimateScroll ? VERDICT_SCROLL_SETTLE_MS : 0);
    });

    return clearPendingScroll;
  }, [answerRevealScrollKey, isAnswerVisible, preparedVerdictScrollKey, session.answer]);

  useLayoutEffect(() => {
    if (!isAnswerVisible || preparedVerdictScrollKey !== answerRevealScrollKey || verdictScrollSpacerHeight <= 0) {
      return undefined;
    }

    const sceneElement = sceneRef.current;
    const scrollContainer = sceneElement?.parentElement;

    if (!sceneElement || !scrollContainer) {
      return undefined;
    }

    let animationFrame = null;

    const updateSpacerHeight = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;

        const containerRect = scrollContainer.getBoundingClientRect();
        const judgeAvatarRect = judgeAvatarRef.current?.getBoundingClientRect();

        if (!judgeAvatarRect) {
          return;
        }

        const currentSpacerHeight = verdictScrollSpacerRef.current?.offsetHeight ?? 0;
        const targetScrollTop = scrollContainer.scrollTop + judgeAvatarRect.top - containerRect.top;
        const naturalMaxScrollTop = Math.max(
          0,
          scrollContainer.scrollHeight - currentSpacerHeight - scrollContainer.clientHeight,
        );
        const nextSpacerHeight = Math.ceil(Math.max(0, targetScrollTop - naturalMaxScrollTop));

        setVerdictScrollSpacerHeight((currentHeight) =>
          Math.abs(currentHeight - nextSpacerHeight) > 1 ? nextSpacerHeight : currentHeight,
        );
      });
    };

    const resizeObserver = new ResizeObserver(updateSpacerHeight);

    resizeObserver.observe(sceneElement);
    resizeObserver.observe(scrollContainer);
    updateSpacerHeight();

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }

      resizeObserver.disconnect();
    };
  }, [answerRevealScrollKey, isAnswerVisible, preparedVerdictScrollKey, verdictScrollSpacerHeight]);

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

      <HypothesisCandidates
        hypotheses={hypotheses}
        isLoading={isHypothesesLoading}
        onOpenKnowledgeGraph={onOpenKnowledgeGraph}
      />
      <DebateStage
        debate={debate}
        manufacturerAvatarRef={manufacturerAvatarRef}
        activeConnectionDirections={activeDebateConnectionDirections}
        debateCycleNumber={debateCycleNumber}
        hideAgentStatus={!hasHypotheses}
        onOpenAgentHistory={onOpenAgentHistory}
      />
      <EvaluationStage
        evaluation={evaluation}
        sessionId={session.id}
        answer={session.answer}
        consultationMessages={session.consultationMessages ?? []}
        isAnswerVisible={isAnswerVisible}
        isVerdictTypewriterReady={isVerdictTypewriterReady}
        hideAgentStatus={!hasHypotheses}
        onVerdictComplete={onVerdictComplete}
        onAgentAvatarRef={setEvaluationAvatarRef}
        judgeAvatarRef={judgeAvatarRef}
        onAgentDragStart={onAgentDragStart}
        onAgentDragEnd={onAgentDragEnd}
        onDropAgent={onDropAgentToEvaluation}
        isDropTargetVisible={!isAgentEditingLocked && dragSource === "palette"}
        isAgentEditingLocked={isAgentEditingLocked}
        onOpenAgentHistory={onOpenAgentHistory}
        verdictActions={verdictActions}
      />
      {isAnswerVisible ? (
        <div
          ref={verdictScrollSpacerRef}
          className="workspace-scene__verdict-scroll-spacer"
          style={{ height: `${verdictScrollSpacerHeight}px` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
