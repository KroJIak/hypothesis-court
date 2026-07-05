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

function createAgentStatusMap(agentIds, status) {
  if (!status) {
    return {};
  }

  return Object.fromEntries(agentIds.map((agentId) => [agentId, status]));
}

function getLatestProgressEvent(progress) {
  return progress?.events?.at(-1) ?? null;
}

function createDebateConnectionDirections(latestEvent) {
  const actorRole = latestEvent?.metadata?.actor_role;

  const directionsByRole = {
    defender: [
      ["top-left-top-right", "forward"],
      ["top-left-bottom", "forward"],
    ],
    attacker: [
      ["top-left-top-right", "reverse"],
      ["top-right-bottom", "forward"],
    ],
    manufacturer: [
      ["top-left-bottom", "reverse"],
      ["top-right-bottom", "reverse"],
    ],
  };

  return new Map(directionsByRole[actorRole] ?? []);
}

function createEvaluationConnectionDirections(latestEvent, agents) {
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

function createDebateRoleStatuses(stage, latestEvent) {
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

function createEvaluationAgentStatuses(stage, latestEvent, agents) {
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

export function createResearchProgressView(session) {
  const stage = session.researchProgress?.currentStage;
  const latestEvent = getLatestProgressEvent(session.researchProgress);
  const evaluationAgentIds = session.evaluation.agents.map((agent) => agent.id);
  const stageStatus = progressStageStatusByRole[stage] ?? null;
  const debateRoleStatuses = {
    ...(stageStatus?.debate ?? {}),
    ...createDebateRoleStatuses(stage, latestEvent),
  };
  const evaluationAgentStatuses = {
    ...createAgentStatusMap(evaluationAgentIds, stageStatus?.evaluation),
    ...createEvaluationAgentStatuses(stage, latestEvent, session.evaluation.agents),
  };

  return {
    activeDebateConnectionDirections: createDebateConnectionDirections(latestEvent),
    activeEvaluationConnectionDirections: createEvaluationConnectionDirections(latestEvent, session.evaluation.agents),
    debateCycleNumber: latestEvent?.metadata?.round_number ?? null,
    debateRoleStatuses,
    evaluationAgentStatuses,
    hasAgentStatus: Boolean(
      stageStatus?.judge
      || Object.keys(debateRoleStatuses).length > 0
      || Object.keys(evaluationAgentStatuses).length > 0,
    ),
    judgeStatus: stageStatus?.judge ?? "",
  };
}
