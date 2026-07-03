import { useCallback, useEffect, useMemo, useState } from "react";

const DEBATE_CYCLE_COUNT = 3;
const DEBATE_STEP_MS = 1200;
const EVALUATION_BROADCAST_MS = 1500;
const EVALUATION_AGENT_STEP_MS = 850;
const EVALUATION_AGENT_STAGGER_MS = 220;
const DIRECT_JUDGE_STEP_MS = 1100;
const ANSWER_REVEAL_DELAY_MS = 700;

const debateSpeakerSteps = [
  {
    activeDebateConnectionIds: ["top-left-top-right", "top-left-bottom"],
  },
  {
    activeDebateConnectionIds: ["top-left-top-right", "top-right-bottom"],
  },
  {
    activeDebateConnectionIds: ["top-left-bottom", "top-right-bottom"],
  },
];

function createDebatePlaybackSteps() {
  return Array.from({ length: DEBATE_CYCLE_COUNT }).flatMap(() =>
    debateSpeakerSteps.map((step) => ({
      ...step,
      durationMs: DEBATE_STEP_MS,
    })),
  );
}

function createEvaluationPlaybackSteps(agentIds) {
  if (agentIds.length === 0) {
    return [
      {
        activeEvaluationConnectionIds: ["manufacturer-judge"],
        durationMs: DIRECT_JUDGE_STEP_MS,
      },
    ];
  }

  return [
    {
      activeEvaluationConnectionIds: agentIds.map((agentId) => `manufacturer-${agentId}`),
      durationMs: EVALUATION_BROADCAST_MS,
    },
    ...agentIds.map((agentId, index) => ({
      activeEvaluationConnectionIds: [`${agentId}-judge`],
      durationMs: EVALUATION_AGENT_STEP_MS + ((index % 3) * EVALUATION_AGENT_STAGGER_MS),
    })),
  ];
}

function createScenePlaybackSteps(session) {
  const agentIds = session.evaluation.agents.map((agent) => agent.id);

  return [
    ...createDebatePlaybackSteps(),
    ...createEvaluationPlaybackSteps(agentIds),
    {
      durationMs: ANSWER_REVEAL_DELAY_MS,
    },
  ];
}

const initialPlaybackState = {
  isAnswerVisible: false,
  stepIndex: null,
};

export function useScenePlayback(session) {
  const steps = useMemo(() => createScenePlaybackSteps(session), [session]);
  const [playbackState, setPlaybackState] = useState(initialPlaybackState);
  const currentStep = playbackState.stepIndex === null ? null : steps[playbackState.stepIndex] ?? null;
  const isRunning = currentStep !== null;

  useEffect(() => {
    setPlaybackState(initialPlaybackState);
  }, [session.id]);

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
            isAnswerVisible: true,
            stepIndex: null,
          };
        }

        return {
          isAnswerVisible: state.isAnswerVisible,
          stepIndex: nextStepIndex,
        };
      });
    }, currentStep.durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [currentStep, steps]);

  const startPlayback = useCallback(() => {
    setPlaybackState({
      isAnswerVisible: false,
      stepIndex: 0,
    });
  }, []);

  return {
    activeDebateConnectionIds: new Set(currentStep?.activeDebateConnectionIds ?? []),
    activeEvaluationConnectionIds: new Set(currentStep?.activeEvaluationConnectionIds ?? []),
    isAnswerVisible: playbackState.isAnswerVisible,
    isRunning,
    startPlayback,
  };
}
