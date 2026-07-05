import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DebateStage } from "./DebateStage";
import { EvaluationStage } from "./EvaluationStage";
import { HypothesisCandidates } from "./HypothesisCandidates";
import { useScenePlayback } from "../hooks/useScenePlayback";
import { getElementCenter, createStraightPath } from "../utils/geometry";

const VERDICT_SCROLL_FRAME_DELAY = 2;

const initialVerdictScroll = {
  key: null,
  phase: "idle",
  spacerHeight: 0,
};

const progressStageStatusByRole = {
  queued: {
    debate: {
      defender: "ожидает",
      attacker: "ожидает",
      manufacturer: "ожидает",
    },
    judge: "ожидает",
  },
  ingestion: {
    debate: {
      manufacturer: "обрабатывает источники",
    },
    judge: "ожидает",
  },
  retrieval: {
    debate: {
      manufacturer: "ищет фрагменты",
    },
    judge: "ожидает",
  },
  evidence: {
    debate: {
      manufacturer: "собирает evidence",
    },
    judge: "ожидает",
  },
  hypothesis_generation: {
    debate: {
      defender: "формирует гипотезы",
      attacker: "проверяет риски",
      manufacturer: "проверяет реализуемость",
    },
    judge: "ожидает",
  },
  debate: {
    debate: {
      defender: "защищает",
      attacker: "критикует",
      manufacturer: "проверяет реализацию",
    },
    judge: "ожидает",
  },
  evaluation: {
    debate: {
      manufacturer: "передаёт оценщикам",
    },
    evaluation: "оценивает",
    judge: "ожидает",
  },
  judge: {
    debate: {
      manufacturer: "ожидает",
    },
    evaluation: "ожидает",
    judge: "формирует вердикт",
  },
  failed: {
    judge: "ошибка",
  },
  cancelled: {
    judge: "остановлено",
  },
};

function createEvaluationStatusMap(agentIds, status) {
  if (!status) {
    return {};
  }

  return Object.fromEntries(agentIds.map((agentId) => [agentId, status]));
}

function getLatestProgressEvent(progress) {
  return progress?.events?.at(-1) ?? null;
}

function createProgressDebateConnectionDirections(latestEvent) {
  const actorRole = latestEvent?.metadata?.actor_role;

  if (actorRole === "defender") {
    return new Map([
      ["top-left-top-right", "forward"],
      ["top-left-bottom", "forward"],
    ]);
  }

  if (actorRole === "attacker") {
    return new Map([
      ["top-left-top-right", "reverse"],
      ["top-right-bottom", "forward"],
    ]);
  }

  if (actorRole === "manufacturer") {
    return new Map([
      ["top-left-bottom", "reverse"],
      ["top-right-bottom", "reverse"],
    ]);
  }

  return new Map();
}

function createProgressEvaluationConnectionDirections(latestEvent, agents) {
  const evaluatorAgentId = latestEvent?.metadata?.user_agent_id;
  const evaluatorKey = latestEvent?.metadata?.evaluator_key;
  const activeAgent = agents.find((agent) => agent.id === evaluatorAgentId || agent.id === evaluatorKey);

  if (!activeAgent) {
    return new Map();
  }

  return new Map([
    [`manufacturer-${activeAgent.id}`, "forward"],
    [`${activeAgent.id}-judge`, "forward"],
  ]);
}

function createProgressDebateRoleStatuses(stage, latestEvent) {
  const actorRole = latestEvent?.metadata?.actor_role;

  if (stage !== "debate" || !actorRole) {
    return {};
  }

  return {
    defender: actorRole === "defender" ? "отвечает" : "слушает",
    attacker: actorRole === "attacker" ? "отвечает" : "слушает",
    manufacturer: actorRole === "manufacturer" ? "отвечает" : "слушает",
  };
}

function createProgressEvaluationAgentStatuses(stage, latestEvent, agents) {
  if (stage !== "evaluation") {
    return {};
  }

  const evaluatorAgentId = latestEvent?.metadata?.user_agent_id;
  const evaluatorKey = latestEvent?.metadata?.evaluator_key;

  return Object.fromEntries(agents.map((agent) => [
    agent.id,
    agent.id === evaluatorAgentId || agent.id === evaluatorKey ? "оценивает" : "ожидает",
  ]));
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getRoleName(role) {
  return {
    defender: "Защитник",
    attacker: "Атакующий",
    manufacturer: "Производственник",
  }[role] ?? role;
}

function getVisibleDebateMessages(session) {
  return (session.hypotheses ?? []).flatMap((hypothesis, hypothesisIndex) =>
    (hypothesis.debateMessages ?? []).map((message) => ({
      id: message.id,
      title: hypothesis.title || `Гипотеза ${hypothesisIndex + 1}`,
      author: getRoleName(message.role),
      text: message.content,
      roundNumber: message.roundNumber,
      createdAt: message.createdAt,
    })),
  ).sort((firstMessage, secondMessage) =>
    new Date(firstMessage.createdAt).getTime() - new Date(secondMessage.createdAt).getTime(),
  );
}

function getVisibleEvaluationGroups(session) {
  const groups = new Map();

  for (const hypothesis of session.hypotheses ?? []) {
    for (const evaluation of hypothesis.evaluations ?? []) {
      const groupKey = evaluation.userAgentId ?? evaluation.evaluatorKey;
      const group = groups.get(groupKey) ?? {
        id: groupKey,
        name: evaluation.evaluatorName,
        messages: [],
      };

      group.messages.push({
        id: evaluation.id,
        title: hypothesis.title,
        text: [
          evaluation.verdict,
          evaluation.rationale,
          evaluation.riskNotes ? `Риски: ${evaluation.riskNotes}` : "",
        ].filter(Boolean).join(" "),
        createdAt: evaluation.createdAt,
      });
      groups.set(groupKey, group);
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    messages: group.messages.sort((firstMessage, secondMessage) =>
      new Date(firstMessage.createdAt).getTime() - new Date(secondMessage.createdAt).getTime(),
    ),
  }));
}

function getVisibleJudgeEvents(session) {
  return (session.researchProgress?.events ?? [])
    .filter((event) => event.stage === "judge")
    .map((event) => ({
      id: event.id,
      text: event.message,
      createdAt: event.createdAt,
    }));
}

function ResearchProcessChats({ session, isVisible }) {
  if (!isVisible) {
    return null;
  }

  const debateMessages = getVisibleDebateMessages(session);
  const evaluationGroups = getVisibleEvaluationGroups(session);
  const judgeEvents = getVisibleJudgeEvents(session);
  const judgeText = session.answer || [
    session.verdict?.summary,
    session.verdict?.recommendation,
  ].filter(Boolean).join(" ");

  return (
    <section className="research-process-chats" aria-label="Живые чаты процесса">
      <article className="research-process-chat">
        <h3 className="research-process-chat__title">Общий чат троицы</h3>
        {debateMessages.length > 0 ? (
          <div className="research-process-chat__messages">
            {debateMessages.map((message) => (
              <div key={message.id} className="research-process-message">
                <span className="research-process-message__meta">
                  {message.title} · {message.roundNumber} цикл · {message.author}
                </span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="research-process-chat__empty">Сообщения появятся, когда начнётся debate.</p>
        )}
      </article>

      <article className="research-process-chat">
        <h3 className="research-process-chat__title">Чаты доп агентов</h3>
        {evaluationGroups.length > 0 ? (
          <div className="research-process-chat__messages">
            {evaluationGroups.map((group) => (
              <div key={group.id} className="research-process-agent-group">
                <span className="research-process-message__meta">{group.name}</span>
                {group.messages.map((message) => (
                  <div key={message.id} className="research-process-message">
                    <span className="research-process-message__meta">{message.title}</span>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="research-process-chat__empty">Оценки появятся после обсуждения гипотез.</p>
        )}
      </article>

      <article className="research-process-chat">
        <h3 className="research-process-chat__title">Чат судьи</h3>
        {judgeText ? (
          <div className="research-process-chat__messages">
            <div className="research-process-message">
              <span className="research-process-message__meta">Судья</span>
              <p>{judgeText}</p>
            </div>
          </div>
        ) : judgeEvents.length > 0 ? (
          <div className="research-process-chat__messages">
            {judgeEvents.map((event) => (
              <div key={event.id} className="research-process-message">
                <span className="research-process-message__meta">Судья</span>
                <p>{event.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="research-process-chat__empty">Вердикт появится после оценок агентов.</p>
        )}
      </article>
    </section>
  );
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
  const verdictScrollFramesRef = useRef([]);
  const [verdictScroll, setVerdictScroll] = useState(initialVerdictScroll);
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
  const currentProgressStage = session.researchProgress?.currentStage;
  const latestProgressEvent = getLatestProgressEvent(session.researchProgress);
  const progressStageStatus = progressStageStatusByRole[currentProgressStage] ?? null;
  const progressDebateRoleStatuses = {
    ...(progressStageStatus?.debate ?? {}),
    ...createProgressDebateRoleStatuses(currentProgressStage, latestProgressEvent),
  };
  const progressEvaluationAgentStatuses = {
    ...createEvaluationStatusMap(
      session.evaluation.agents.map((agent) => agent.id),
      progressStageStatus?.evaluation,
    ),
    ...createProgressEvaluationAgentStatuses(currentProgressStage, latestProgressEvent, session.evaluation.agents),
  };
  const progressDebateConnectionDirections = createProgressDebateConnectionDirections(latestProgressEvent);
  const progressEvaluationConnectionDirections = createProgressEvaluationConnectionDirections(
    latestProgressEvent,
    session.evaluation.agents,
  );
  const activeDebateDirections = progressDebateConnectionDirections.size > 0
    ? progressDebateConnectionDirections
    : activeDebateConnectionDirections;
  const activeEvaluationDirections = progressEvaluationConnectionDirections.size > 0
    ? progressEvaluationConnectionDirections
    : activeEvaluationConnectionDirections;
  const activeDebateCycleNumber = latestProgressEvent?.metadata?.round_number ?? debateCycleNumber;
  const hasProgressAgentStatus = Boolean(
    progressStageStatus?.judge
    || Object.keys(progressDebateRoleStatuses).length > 0
    || Object.keys(progressEvaluationAgentStatuses).length > 0,
  );
  const answerRevealScrollKey = `${session.id}:${session.answer ?? ""}`;
  const isVerdictTypewriterReady = !isAnswerVisible
    || (verdictScroll.key === answerRevealScrollKey && verdictScroll.phase === "ready");
  const debate = useMemo(() => ({
    ...session.debate,
    roles: session.debate.roles.map((role) => ({
      ...role,
      status: debateRoleStatuses[role.id] ?? progressDebateRoleStatuses[role.id] ?? "",
    })),
  }), [debateRoleStatuses, progressDebateRoleStatuses, session.debate]);
  const evaluation = useMemo(() => ({
    ...session.evaluation,
    agents: session.evaluation.agents.map((agent) => ({
      ...agent,
      status: evaluationAgentStatuses[agent.id] ?? progressEvaluationAgentStatuses[agent.id] ?? "",
    })),
    judge: {
      ...session.evaluation.judge,
      status: judgeStatus || progressStageStatus?.judge || "",
    },
  }), [evaluationAgentStatuses, judgeStatus, progressEvaluationAgentStatuses, progressStageStatus?.judge, session.evaluation]);

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
        height: sceneRect.height,
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

  const cancelVerdictScrollFrames = useCallback(() => {
    verdictScrollFramesRef.current.forEach((frameId) => window.cancelAnimationFrame(frameId));
    verdictScrollFramesRef.current = [];
  }, []);

  const getVerdictScrollGeometry = useCallback(() => {
    const sceneElement = sceneRef.current;
    const judgeAvatarElement = judgeAvatarRef.current;
    const scrollContainer = sceneElement?.parentElement;

    if (!sceneElement || !judgeAvatarElement || !scrollContainer) {
      return null;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const judgeAvatarRect = judgeAvatarElement.getBoundingClientRect();
    const scrollContainerStyles = window.getComputedStyle(scrollContainer);
    const targetOffset = Number.parseFloat(
      scrollContainerStyles.getPropertyValue("--workspace-verdict-scroll-top-offset"),
    ) || 0;
    const spacerElement = verdictScrollSpacerRef.current;
    const targetScrollTop = scrollContainer.scrollTop + judgeAvatarRect.top - containerRect.top - targetOffset;
    const contentHeightWithoutSpacer = spacerElement
      ? spacerElement.offsetTop
      : [...sceneElement.children]
        .filter((child) =>
          !child.classList.contains("workspace-scene__connection-layer")
          && !child.classList.contains("workspace-scene__verdict-scroll-spacer"),
        )
        .reduce((height, child) => Math.max(height, child.offsetTop + child.offsetHeight), 0);
    const requiredSpacerHeight = Math.ceil(Math.max(
      0,
      targetScrollTop + scrollContainer.clientHeight - contentHeightWithoutSpacer,
    ));

    return {
      scrollContainer,
      targetScrollTop,
      requiredSpacerHeight,
    };
  }, []);

  const scheduleAfterFrames = useCallback((frameCount, callback) => {
    let remainingFrames = frameCount;

    const runNextFrame = () => {
      if (remainingFrames <= 0) {
        callback();
        return;
      }

      remainingFrames -= 1;
      const frameId = window.requestAnimationFrame(() => {
        verdictScrollFramesRef.current = verdictScrollFramesRef.current.filter((storedFrameId) => storedFrameId !== frameId);
        runNextFrame();
      });

      verdictScrollFramesRef.current.push(frameId);
    };

    runNextFrame();
  }, []);

  useLayoutEffect(() => {
    cancelVerdictScrollFrames();

    if (!isAnswerVisible || !session.answer) {
      setVerdictScroll((currentScroll) =>
        currentScroll.phase === "idle" && currentScroll.spacerHeight === 0
          ? currentScroll
          : initialVerdictScroll,
      );
      return undefined;
    }

    if (verdictScroll.key !== answerRevealScrollKey) {
      setVerdictScroll({
        key: answerRevealScrollKey,
        phase: "measure",
        spacerHeight: 0,
      });
      return undefined;
    }

    if (verdictScroll.phase === "measure") {
      const geometry = getVerdictScrollGeometry();

      if (!geometry) {
        setVerdictScroll({
          key: answerRevealScrollKey,
          phase: "ready",
          spacerHeight: 0,
        });
        return undefined;
      }

      setVerdictScroll({
        key: answerRevealScrollKey,
        phase: "scroll",
        spacerHeight: geometry.requiredSpacerHeight,
      });
      return undefined;
    }

    if (verdictScroll.phase !== "scroll") {
      return undefined;
    }

    scheduleAfterFrames(VERDICT_SCROLL_FRAME_DELAY, () => {
      const geometry = getVerdictScrollGeometry();

      if (!geometry) {
        setVerdictScroll((currentScroll) => ({
          key: answerRevealScrollKey,
          phase: "ready",
          spacerHeight: currentScroll.key === answerRevealScrollKey ? currentScroll.spacerHeight : 0,
        }));
        return;
      }

      const maxScrollTop = Math.max(0, geometry.scrollContainer.scrollHeight - geometry.scrollContainer.clientHeight);
      const hasGeneratedScrollSpace = verdictScroll.spacerHeight > 0;
      const nextScrollTop = hasGeneratedScrollSpace
        ? maxScrollTop
        : clampNumber(geometry.targetScrollTop, 0, maxScrollTop);

      geometry.scrollContainer.scrollTo({
        top: nextScrollTop,
        behavior: "auto",
      });

      const readyFrameId = window.requestAnimationFrame(() => {
        verdictScrollFramesRef.current = verdictScrollFramesRef.current.filter((storedFrameId) => storedFrameId !== readyFrameId);
        setVerdictScroll((currentScroll) => ({
          key: answerRevealScrollKey,
          phase: "ready",
          spacerHeight: currentScroll.key === answerRevealScrollKey
            ? currentScroll.spacerHeight
            : geometry.requiredSpacerHeight,
        }));
      });
      verdictScrollFramesRef.current.push(readyFrameId);
    });

    return cancelVerdictScrollFrames;
  }, [
    answerRevealScrollKey,
    cancelVerdictScrollFrames,
    getVerdictScrollGeometry,
    isAnswerVisible,
    scheduleAfterFrames,
    session.answer,
    verdictScroll.key,
    verdictScroll.phase,
    verdictScroll.spacerHeight,
  ]);

  useLayoutEffect(() => {
    if (
      !isAnswerVisible
      || verdictScroll.key !== answerRevealScrollKey
      || verdictScroll.phase !== "ready"
      || verdictScroll.spacerHeight <= 0
    ) {
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

        const geometry = getVerdictScrollGeometry();

        if (!geometry) {
          return;
        }

        setVerdictScroll((currentScroll) => {
          if (currentScroll.key !== answerRevealScrollKey || currentScroll.phase !== "ready") {
            return currentScroll;
          }

          return Math.abs(currentScroll.spacerHeight - geometry.requiredSpacerHeight) > 1
            ? { ...currentScroll, spacerHeight: geometry.requiredSpacerHeight }
            : currentScroll;
        });
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
  }, [
    answerRevealScrollKey,
    getVerdictScrollGeometry,
    isAnswerVisible,
    verdictScroll.key,
    verdictScroll.phase,
    verdictScroll.spacerHeight,
  ]);

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
              className={activeEvaluationDirections.has(path.id) ? "connection-path connection-path--active" : getEvaluationConnectionClassName(path.id)}
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
        activeConnectionDirections={activeDebateDirections}
        debateCycleNumber={activeDebateCycleNumber}
        hideAgentStatus={!hasHypotheses && !hasProgressAgentStatus}
        onOpenAgentHistory={onOpenAgentHistory}
      />
      <EvaluationStage
        evaluation={evaluation}
        sessionId={session.id}
        answer={session.answer}
        consultationMessages={session.consultationMessages ?? []}
        isAnswerVisible={isAnswerVisible}
        isVerdictTypewriterReady={isVerdictTypewriterReady}
        hideAgentStatus={!hasHypotheses && !hasProgressAgentStatus}
        onVerdictComplete={onVerdictComplete}
        onAgentAvatarRef={setEvaluationAvatarRef}
        judgeAvatarRef={judgeAvatarRef}
        onAgentDragStart={onAgentDragStart}
        onAgentDragEnd={onAgentDragEnd}
        onDropAgent={onDropAgentToEvaluation}
        isDropTargetVisible={!isAgentEditingLocked && (dragSource === "palette" || dragSource === "evaluation")}
        isAgentEditingLocked={isAgentEditingLocked}
        onOpenAgentHistory={onOpenAgentHistory}
        verdictActions={verdictActions}
      />
      <ResearchProcessChats
        session={session}
        isVisible={session.isStarted || Boolean(session.activeResearchRunId)}
      />
      {isAnswerVisible ? (
        <div
          ref={verdictScrollSpacerRef}
          className="workspace-scene__verdict-scroll-spacer"
          style={{ height: `${verdictScroll.spacerHeight}px` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
