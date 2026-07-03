import { useCallback, useEffect, useMemo, useState } from "react";

import {
  PROCESSING_STATUS_PROCESSING,
  PROCESSING_STATUS_PROCESSED,
  PROCESSING_STATUS_QUEUED,
} from "../constants";

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
  return Array.from({ length: DEBATE_CYCLE_COUNT }).flatMap(() =>
    debateSpeakerSteps.flatMap((step) => [
      {
        phase: "debate",
        hypothesisIndex,
        debateRoleStatuses: createDebateThinkingStatuses(step.senderId),
        durationMs: DEBATE_THINK_STEP_MS,
      },
      {
        ...step,
        phase: "debate",
        hypothesisIndex,
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

function getHypothesesWithPlaybackStatus(hypotheses, playbackState, currentStep) {
  if (!hypotheses || hypotheses.length === 0) {
    return [];
  }

  return hypotheses.map((hypothesis, index) => {
    if (playbackState.isAnswerVisible || index < playbackState.completedHypothesisCount) {
      return {
        ...hypothesis,
        processingStatus: PROCESSING_STATUS_PROCESSED,
      };
    }

    if (index === currentStep?.hypothesisIndex) {
      return {
        ...hypothesis,
        processingStatus: PROCESSING_STATUS_PROCESSING,
      };
    }

    return {
      ...hypothesis,
      processingStatus: PROCESSING_STATUS_QUEUED,
    };
  });
}

export function useScenePlayback(session) {
  const steps = useMemo(() => createScenePlaybackSteps(session), [session]);
  const [playbackState, setPlaybackState] = useState(initialPlaybackState);
  const currentStep = playbackState.stepIndex === null ? null : steps[playbackState.stepIndex] ?? null;
  const isRunning = currentStep !== null;

  useEffect(() => {
    if (!session.hypotheses || session.hypotheses.length === 0) {
      setPlaybackState(initialPlaybackState);
      return;
    }

    setPlaybackState({
      completedHypothesisCount: 0,
      isAnswerVisible: false,
      stepIndex: 0,
    });
  }, [session.id, session.hypotheses]);

  useEffect(() => {
    if (!currentStep) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setPlaybackState((state) => {
        const nextStepIndex = (state.stepIndex ?? 0) + 1;
        const nextStep = steps[nextStepIndex];

        if (!nextStep) {
          return {
            completedHypothesisCount: session.hypotheses?.length ?? state.completedHypothesisCount,
            isAnswerVisible: true,
            stepIndex: null,
          };
        }

        return {
          completedHypothesisCount: currentStep.completedHypothesisIndex === undefined
            ? state.completedHypothesisCount
            : Math.max(state.completedHypothesisCount, currentStep.completedHypothesisIndex + 1),
          isAnswerVisible: state.isAnswerVisible,
          stepIndex: nextStepIndex,
        };
      });
    }, currentStep.durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [currentStep, session.hypotheses?.length, steps]);

  const startPlayback = useCallback(() => {
    if (!session.hypotheses || session.hypotheses.length === 0) {
      return;
    }

    setPlaybackState({
      completedHypothesisCount: 0,
      isAnswerVisible: false,
      stepIndex: 0,
    });
  }, [session.hypotheses]);

  return {
    activeDebateConnectionDirections: createActiveConnectionMap(currentStep?.activeDebateConnections),
    activeEvaluationConnectionDirections: createActiveConnectionMap(currentStep?.activeEvaluationConnections),
    debateRoleStatuses: getDebateRoleStatuses(currentStep),
    evaluationAgentStatuses: getEvaluationAgentStatuses(session, currentStep),
    hypotheses: getHypothesesWithPlaybackStatus(session.hypotheses ?? [], playbackState, currentStep),
    isAnswerVisible: playbackState.isAnswerVisible,
    isRunning,
    judgeStatus: getJudgeStatus(session, currentStep),
    startPlayback,
  };
}
