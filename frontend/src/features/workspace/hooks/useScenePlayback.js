import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEBATE_CYCLE_COUNT = 3;
const DEBATE_STEP_MS = 1200;
const EVALUATION_BROADCAST_MS = 1500;
const EVALUATION_AGENT_STEP_MS = 850;
const EVALUATION_AGENT_STAGGER_MS = 220;
const HYPOTHESIS_COMPLETE_MS = 360;
const ANSWER_REVEAL_DELAY_MS = 700;
const DEBATE_THINK_STEP_MS = 460;
const EVALUATION_THINK_STEP_MS = 680;
const JUDGE_THINK_STEP_MS = 760;
const JUDGE_VERDICT_STEP_MS = 820;

const DEBATE_ROLE_IDS = ["defender", "attacker", "manufacturer"];
const STATUS_ANSWERS = "отвечает";
const STATUS_LISTENS = "слушает";
const STATUS_THINKS = "размышляет";
const STATUS_WAITS = "ожидает";
const STATUS_EVALUATES = "оценивает";
const STATUS_VERDICT = "выносит вердикт";
const PLAYBACK_TICK_MS = 180;
const SCENE_PLAYBACK_RESET_EVENT = "workspace:scene-playback-reset";

export function resetScenePlayback(sessionId) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(SCENE_PLAYBACK_RESET_EVENT, {
    detail: { sessionId },
  }));
}

const debateSpeakerSteps = [
  {
    senderId: "defender",
    receiverIds: ["attacker", "manufacturer"],
    activeDebateConnections: [
      { id: "top-left-top-right", direction: "forward" },
      { id: "top-left-bottom", direction: "forward" },
    ],
  },
  {
    senderId: "attacker",
    receiverIds: ["defender", "manufacturer"],
    activeDebateConnections: [
      { id: "top-left-top-right", direction: "reverse" },
      { id: "top-right-bottom", direction: "forward" },
    ],
  },
  {
    senderId: "manufacturer",
    receiverIds: ["defender", "attacker"],
    activeDebateConnections: [
      { id: "top-left-bottom", direction: "reverse" },
      { id: "top-right-bottom", direction: "reverse" },
    ],
  },
];

function createDebateThinkingStatuses(senderId) {
  return Object.fromEntries(
    DEBATE_ROLE_IDS.map((roleId) => [
      roleId,
      roleId === senderId ? STATUS_THINKS : STATUS_WAITS,
    ]),
  );
}

function createDebateSpeakingStatuses(senderId, receiverIds) {
  return Object.fromEntries(
    DEBATE_ROLE_IDS.map((roleId) => {
      if (roleId === senderId) {
        return [roleId, STATUS_ANSWERS];
      }

      if (receiverIds.includes(roleId)) {
        return [roleId, STATUS_LISTENS];
      }

      return [roleId, STATUS_WAITS];
    }),
  );
}

function createAgentStatusMap(agentIds, status) {
  return Object.fromEntries(agentIds.map((agentId) => [agentId, status]));
}

function createDebatePlaybackSteps(hypothesisIndex) {
  return Array.from({ length: DEBATE_CYCLE_COUNT }).flatMap((_, cycleIndex) =>
    debateSpeakerSteps.flatMap((step) => [
      {
        phase: "debate",
        hypothesisIndex,
        debateCycleNumber: cycleIndex + 1,
        debateRoleStatuses: createDebateThinkingStatuses(step.senderId),
        durationMs: DEBATE_THINK_STEP_MS,
      },
      {
        ...step,
        phase: "debate",
        hypothesisIndex,
        debateCycleNumber: cycleIndex + 1,
        debateRoleStatuses: createDebateSpeakingStatuses(step.senderId, step.receiverIds),
        durationMs: DEBATE_STEP_MS,
      },
    ]),
  );
}

function createEvaluationJudgeSteps(agentIds, hypothesisIndex) {
  const agentWaveGroups = agentIds.reduce((groups, agentId, index) => {
    const waveIndex = index % 2;

    return groups.map((group, groupIndex) =>
      groupIndex === waveIndex ? [...group, agentId] : group,
    );
  }, [[], []]).filter((group) => group.length > 0);

  return [
    {
      phase: "evaluation",
      hypothesisIndex,
      activeEvaluationConnections: [
        "manufacturer-judge",
        ...agentIds.map((agentId) => `manufacturer-${agentId}`),
      ].map((id) => ({ id, direction: "forward" })),
      debateRoleStatuses: {
        manufacturer: STATUS_ANSWERS,
      },
      evaluationAgentStatuses: createAgentStatusMap(agentIds, STATUS_LISTENS),
      judgeStatus: STATUS_LISTENS,
      durationMs: EVALUATION_BROADCAST_MS,
    },
    {
      phase: "evaluation",
      hypothesisIndex,
      evaluationAgentStatuses: createAgentStatusMap(agentIds, STATUS_THINKS),
      judgeStatus: STATUS_WAITS,
      durationMs: EVALUATION_THINK_STEP_MS,
    },
    ...agentWaveGroups.map((agentGroup, waveIndex) => {
      const futureAgentIds = agentWaveGroups.slice(waveIndex + 1).flat();
      const futureThinkingStatuses = createAgentStatusMap(futureAgentIds, STATUS_THINKS);
      const activeEvaluationStatuses = createAgentStatusMap(agentGroup, STATUS_EVALUATES);

      return {
        phase: "evaluation",
        hypothesisIndex,
        activeEvaluationConnections: agentGroup.map((agentId) => ({
          id: `${agentId}-judge`,
          direction: "forward",
        })),
        evaluationAgentStatuses: {
          ...futureThinkingStatuses,
          ...activeEvaluationStatuses,
        },
        judgeStatus: STATUS_LISTENS,
        durationMs: EVALUATION_AGENT_STEP_MS + (waveIndex * EVALUATION_AGENT_STAGGER_MS),
      };
    }),
    {
      phase: "evaluation",
      hypothesisIndex,
      judgeStatus: STATUS_THINKS,
      durationMs: JUDGE_THINK_STEP_MS,
    },
    {
      phase: "evaluation",
      hypothesisIndex,
      judgeStatus: STATUS_VERDICT,
      durationMs: JUDGE_VERDICT_STEP_MS,
    },
  ];
}

function createHypothesisPlaybackSteps(hypothesisIndex, agentIds) {
  return [
    ...createDebatePlaybackSteps(hypothesisIndex),
    ...createEvaluationJudgeSteps(agentIds, hypothesisIndex),
    {
      hypothesisIndex,
      completedHypothesisIndex: hypothesisIndex,
      durationMs: HYPOTHESIS_COMPLETE_MS,
    },
  ];
}

function createScenePlaybackSteps(session) {
  const agentIds = session.evaluation.agents.map((agent) => agent.id);
  const hypothesisCount = session.hypotheses?.length ?? 0;

  return [
    ...Array.from({ length: hypothesisCount }).flatMap((_, hypothesisIndex) =>
      createHypothesisPlaybackSteps(hypothesisIndex, agentIds),
    ),
    {
      durationMs: ANSWER_REVEAL_DELAY_MS,
    },
  ];
}

const initialPlaybackState = {
  completedHypothesisCount: 0,
  isAnswerVisible: false,
  stepIndex: null,
};

function createPlaybackSignature(session) {
  const hypothesisIds = (session.hypotheses ?? []).map((hypothesis) => hypothesis.id).join(",");
  const evaluationAgentIds = (session.evaluation.agents ?? []).map((agent) => agent.id).join(",");

  return `${hypothesisIds}|${evaluationAgentIds}`;
}

function getOrCreatePlaybackTimeline(session, timelineRef) {
  if (session.researchProgress?.run?.status === "running") {
    timelineRef.current = null;
    return null;
  }

  if (!session.hypotheses || session.hypotheses.length === 0) {
    timelineRef.current = null;
    return null;
  }

  const signature = createPlaybackSignature(session);
  const existingTimeline = timelineRef.current;

  if (existingTimeline?.sessionId === session.id && existingTimeline?.signature === signature) {
    return existingTimeline;
  }

  const nextTimeline = {
    sessionId: session.id,
    signature,
    startedAt: Date.now(),
  };

  timelineRef.current = nextTimeline;

  return nextTimeline;
}

function getPlaybackStateAtTime(steps, timeline, hypothesisCount, now) {
  if (!timeline || steps.length === 0) {
    return initialPlaybackState;
  }

  const elapsedMs = Math.max(0, now - timeline.startedAt);
  let elapsedStepMs = 0;
  let completedHypothesisCount = 0;

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];

    if (elapsedMs < elapsedStepMs + step.durationMs) {
      return {
        completedHypothesisCount,
        isAnswerVisible: false,
        stepIndex,
      };
    }

    elapsedStepMs += step.durationMs;

    if (step.completedHypothesisIndex !== undefined) {
      completedHypothesisCount = Math.max(completedHypothesisCount, step.completedHypothesisIndex + 1);
    }
  }

  return {
    completedHypothesisCount: hypothesisCount,
    isAnswerVisible: true,
    stepIndex: null,
  };
}

function createActiveConnectionMap(connections = []) {
  return new Map(connections.map((connection) => [connection.id, connection.direction]));
}

function getDebateRoleStatuses(currentStep) {
  return currentStep?.debateRoleStatuses ?? {};
}

function getEvaluationAgentStatuses(session, currentStep) {
  if (!session.hypotheses || session.hypotheses.length === 0 || !currentStep) {
    return {};
  }

  if (currentStep.evaluationAgentStatuses) {
    return currentStep.evaluationAgentStatuses;
  }

  if (currentStep.phase === "debate") {
    return createAgentStatusMap(
      session.evaluation.agents.map((agent) => agent.id),
      STATUS_WAITS,
    );
  }

  return {};
}

function getJudgeStatus(session, currentStep) {
  if (!session.hypotheses || session.hypotheses.length === 0 || !currentStep) {
    return "";
  }

  if (currentStep.judgeStatus) {
    return currentStep.judgeStatus;
  }

  if (currentStep.phase === "debate") {
    return STATUS_WAITS;
  }

  return "";
}

function getDebateCycleNumber(currentStep) {
  return currentStep?.phase === "debate" ? currentStep.debateCycleNumber ?? null : null;
}

function getHypothesesWithPlaybackStatus(hypotheses, playbackState, currentStep) {
  if (!hypotheses || hypotheses.length === 0) {
    return [];
  }

  const visibleHypothesisCount = currentStep?.hypothesisIndex === undefined
    ? Math.min(hypotheses.length, playbackState.completedHypothesisCount)
    : Math.min(hypotheses.length, currentStep.hypothesisIndex + 1);
  const visibleHypotheses = playbackState.isAnswerVisible
    ? hypotheses
    : hypotheses.slice(0, visibleHypothesisCount);

  return visibleHypotheses;
}

export function useScenePlayback(session) {
  const playbackTimelineRef = useRef(null);
  const isBackendRunLive = session.researchProgress?.run?.status === "running";
  const steps = useMemo(() => createScenePlaybackSteps(session), [session]);
  const playbackTimeline = useMemo(() => getOrCreatePlaybackTimeline(session, playbackTimelineRef), [session]);
  const [playbackNow, setPlaybackNow] = useState(() => Date.now());
  const playbackState = getPlaybackStateAtTime(
    steps,
    playbackTimeline,
    session.hypotheses?.length ?? 0,
    playbackNow,
  );
  const currentStep = playbackState.stepIndex === null ? null : steps[playbackState.stepIndex] ?? null;
  const isRunning = currentStep !== null;

  useEffect(() => {
    setPlaybackNow(Date.now());

    if (!playbackTimeline) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setPlaybackNow(Date.now());
    }, PLAYBACK_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [playbackTimeline]);

  useEffect(() => {
    const handleReset = (event) => {
      if (event.detail?.sessionId !== session.id) {
        return;
      }

      playbackTimelineRef.current = null;
      setPlaybackNow(Date.now());
    };

    window.addEventListener(SCENE_PLAYBACK_RESET_EVENT, handleReset);

    return () => window.removeEventListener(SCENE_PLAYBACK_RESET_EVENT, handleReset);
  }, [session.id]);

  const startPlayback = useCallback(() => {
    if (!session.hypotheses || session.hypotheses.length === 0) {
      return;
    }

    getOrCreatePlaybackTimeline(session, playbackTimelineRef);
    setPlaybackNow(Date.now());
  }, [session]);

  return {
    activeDebateConnectionDirections: isBackendRunLive ? new Map() : createActiveConnectionMap(currentStep?.activeDebateConnections),
    activeEvaluationConnectionDirections: isBackendRunLive ? new Map() : createActiveConnectionMap(currentStep?.activeEvaluationConnections),
    debateCycleNumber: isBackendRunLive ? null : getDebateCycleNumber(currentStep),
    debateRoleStatuses: isBackendRunLive ? {} : getDebateRoleStatuses(currentStep),
    evaluationAgentStatuses: isBackendRunLive ? {} : getEvaluationAgentStatuses(session, currentStep),
    hypotheses: isBackendRunLive
      ? session.hypotheses ?? []
      : getHypothesesWithPlaybackStatus(session.hypotheses ?? [], playbackState, currentStep),
    isAnswerVisible: isBackendRunLive ? Boolean(session.answer) : playbackState.isAnswerVisible,
    isRunning,
    judgeStatus: isBackendRunLive ? "" : getJudgeStatus(session, currentStep),
    startPlayback,
  };
}
