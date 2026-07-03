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

const debateSpeakerSteps = [
  {
    activeDebateConnections: [
      { id: "top-left-top-right", direction: "forward" },
      { id: "top-left-bottom", direction: "forward" },
    ],
  },
  {
    activeDebateConnections: [
      { id: "top-left-top-right", direction: "reverse" },
      { id: "top-right-bottom", direction: "forward" },
    ],
  },
  {
    activeDebateConnections: [
      { id: "top-left-bottom", direction: "reverse" },
      { id: "top-right-bottom", direction: "reverse" },
    ],
  },
];

function createDebatePlaybackSteps(hypothesisIndex) {
  return Array.from({ length: DEBATE_CYCLE_COUNT }).flatMap(() =>
    debateSpeakerSteps.map((step) => ({
      ...step,
      hypothesisIndex,
      durationMs: DEBATE_STEP_MS,
    })),
  );
}

function createEvaluationJudgeSteps(agentIds, hypothesisIndex) {
  return [
    {
      hypothesisIndex,
      activeEvaluationConnections: [
        "manufacturer-judge",
        ...agentIds.map((agentId) => `manufacturer-${agentId}`),
      ].map((id) => ({ id, direction: "forward" })),
      durationMs: EVALUATION_BROADCAST_MS,
    },
    ...agentIds.reduce((steps, agentId, index) => {
      const waveIndex = index % 2;
      const existingWave = steps[waveIndex];
      const connection = { id: `${agentId}-judge`, direction: "forward" };

      if (existingWave) {
        existingWave.activeEvaluationConnections.push(connection);
        return steps;
      }

      return [
        ...steps,
        {
          hypothesisIndex,
          activeEvaluationConnections: [connection],
          durationMs: EVALUATION_AGENT_STEP_MS + (waveIndex * EVALUATION_AGENT_STAGGER_MS),
        },
      ];
    }, []),
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
    hypotheses: getHypothesesWithPlaybackStatus(session.hypotheses ?? [], playbackState, currentStep),
    isAnswerVisible: playbackState.isAnswerVisible,
    isRunning,
    startPlayback,
  };
}
