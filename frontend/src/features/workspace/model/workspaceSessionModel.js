import {
  DEFAULT_EVALUATION_AGENT_STATUS,
  EVALUATION_SIDE_LEFT,
  EVALUATION_SIDE_RIGHT,
} from "../constants";

const SYSTEM_DEBATE_ROLES = [
  {
    id: "defender",
    name: "Защищающий",
    status: "",
    variant: "defender",
    placement: "top-left",
  },
  {
    id: "attacker",
    name: "Атакующий",
    status: "",
    variant: "attacker",
    placement: "top-right",
  },
  {
    id: "manufacturer",
    name: "Производственник",
    status: "",
    variant: "manufacturer",
    placement: "bottom-center",
  },
];

const SYSTEM_JUDGE = {
  id: "judge",
  name: "Судья",
  status: "",
  variant: "judge",
};

const CONTEXT_LABELS_BY_KIND = {
  constraints: "Ограничения",
  context: "Контекст",
  custom: "Дополнительно",
  kpi: "KPI",
};

export function sortAvailableAgents(agents) {
  return [...agents].sort((firstAgent, secondAgent) => {
    if (firstAgent.isPendingSetup !== secondAgent.isPendingSetup) {
      return firstAgent.isPendingSetup ? -1 : 1;
    }

    if (firstAgent.isCustom !== secondAgent.isCustom) {
      return firstAgent.isCustom ? -1 : 1;
    }

    if (firstAgent.isCustom && secondAgent.isCustom) {
      const firstCreatedAt = Date.parse(firstAgent.createdAt ?? "");
      const secondCreatedAt = Date.parse(secondAgent.createdAt ?? "");

      if (Number.isFinite(firstCreatedAt) && Number.isFinite(secondCreatedAt) && firstCreatedAt !== secondCreatedAt) {
        return secondCreatedAt - firstCreatedAt;
      }
    }

    if (firstAgent.isEmpty === secondAgent.isEmpty) {
      return 0;
    }

    return firstAgent.isEmpty ? 1 : -1;
  });
}

export function getInitialAvailableAgents(session, paletteAgents) {
  const selectedAgentIds = new Set(session.evaluation.agents.map((agent) => agent.id));

  return sortAvailableAgents(
    paletteAgents.filter((agent) => !agent.isEmpty && !selectedAgentIds.has(agent.id)),
  );
}

export function createWorkspaceSession(session, paletteAgents) {
  const runVersions = session.runVersions ?? [];

  return {
    ...session,
    composerRequests: session.composerRequests ?? [],
    launchedRequests: session.launchedRequests ?? [],
    hypotheses: session.hypotheses ?? [],
    runVersions,
    activeRunVersionId: session.activeRunVersionId ?? runVersions.at(-1)?.id ?? null,
    availableAgents: getInitialAvailableAgents(session, paletteAgents),
  };
}

export function applyChatSessionMetadata(session, chatSession) {
  return {
    ...session,
    id: chatSession.id,
    title: chatSession.title,
    isStarted: chatSession.isStarted,
    isPinned: chatSession.isPinned,
    pinnedAt: chatSession.pinnedAt,
    createdAt: chatSession.createdAt,
    updatedAt: chatSession.updatedAt,
  };
}

export function createWorkspaceSessionFromChatSession(chatSession, paletteAgents) {
  return createWorkspaceSession({
    id: chatSession.id,
    title: chatSession.title,
    isStarted: chatSession.isStarted,
    isPinned: chatSession.isPinned,
    pinnedAt: chatSession.pinnedAt,
    createdAt: chatSession.createdAt,
    updatedAt: chatSession.updatedAt,
    query: "Новая гипотеза появится здесь после отправки запроса.",
    answer: "",
    attachments: [],
    composerRequests: [],
    launchedRequests: [],
    hypotheses: [],
    activeResearchRunId: null,
    activeRunVersionId: null,
    runVersions: [],
    availableAgents: sortAvailableAgents(paletteAgents.filter((agent) => !agent.isEmpty)),
    debate: {
      playLabel: "Запустить обсуждение",
      roles: SYSTEM_DEBATE_ROLES,
    },
    evaluation: {
      layoutBias: undefined,
      agents: [],
      judge: SYSTEM_JUDGE,
    },
  }, paletteAgents);
}

export function createEvaluationAgent(agent) {
  return {
    ...agent,
    status: agent.status ?? DEFAULT_EVALUATION_AGENT_STATUS,
  };
}

export function createComposerRequest(context, text) {
  const requestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `composer-request-${Date.now()}`;

  return {
    id: requestId,
    context,
    text,
  };
}

export function formatComposerRequest(request) {
  return `${request.context.label} ${request.text}`;
}

export function createChatTitleFromRequests(requests) {
  const titleSource = (requests.find((request) => request.context.value === "context") ?? requests[0])?.text ?? "";
  const normalizedTitle = titleSource
    .replace(/[.,;:!?]+$/u, "")
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 7)
    .join(" ");

  if (!normalizedTitle) {
    return "Новая проверка гипотез";
  }

  return normalizedTitle.length > 54 ? `${normalizedTitle.slice(0, 51).trim()}...` : normalizedTitle;
}

export function createComposerRequestsFromResearchInputs(inputs) {
  return [...(inputs ?? [])]
    .sort((firstInput, secondInput) => firstInput.position - secondInput.position)
    .map((input) => ({
      id: input.id,
      context: {
        value: input.kind,
        label: input.label || CONTEXT_LABELS_BY_KIND[input.kind] || "Дополнительно",
      },
      text: input.text,
    }));
}

function createHypothesisDescription(hypothesis) {
  return [
    hypothesis.statement,
    hypothesis.mechanism ? `Механизм: ${hypothesis.mechanism}` : "",
    hypothesis.kpiAlignment ? `KPI: ${hypothesis.kpiAlignment}` : "",
    hypothesis.feasibility ? `Реализуемость: ${hypothesis.feasibility}` : "",
    hypothesis.riskProfile ? `Риски: ${hypothesis.riskProfile}` : "",
  ].filter(Boolean).join(" ");
}

function createVerdictAnswer(verdict) {
  if (!verdict) {
    return "";
  }

  const checks = (verdict.nextChecks ?? [])
    .filter(Boolean)
    .map((check) => `Проверить: ${check}`)
    .join(" ");

  return [
    verdict.summary,
    verdict.recommendation,
    checks,
  ].filter(Boolean).join(" ");
}

export function createRunVersionFromResearchRunSummary(run) {
  return {
    id: run.id,
    title: run.title,
    requests: [],
    query: "",
    answer: "",
    hypotheses: [],
    consultationMessages: [],
    modelName: run.modelName ?? "LLM модель",
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    status: run.status,
    errorMessage: run.errorMessage,
    evidence: [],
    verdict: null,
    isDetailLoaded: false,
  };
}

export function createRunVersionFromResearchRun(run) {
  const requests = createComposerRequestsFromResearchInputs(run.inputs);
  const hypotheses = (run.hypotheses ?? [])
    .sort((firstHypothesis, secondHypothesis) => firstHypothesis.position - secondHypothesis.position)
    .map((hypothesis) => ({
      ...hypothesis,
      description: createHypothesisDescription(hypothesis),
    }));
  const answer = createVerdictAnswer(run.verdict);

  return {
    id: run.id,
    title: run.title,
    requests,
    query: requests.map(formatComposerRequest).join("\n"),
    answer,
    hypotheses,
    consultationMessages: [],
    modelName: run.modelName ?? "LLM модель",
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    status: run.status,
    errorMessage: run.errorMessage,
    evidence: run.evidence ?? [],
    verdict: run.verdict,
    isDetailLoaded: true,
  };
}

export function applyResearchRunsToSession(session, runSummaries, activeRunId = null) {
  const loadedVersionsById = new Map((session.runVersions ?? [])
    .filter((version) => version.isDetailLoaded)
    .map((version) => [version.id, version]));
  const runVersions = runSummaries.map((run) =>
    loadedVersionsById.get(run.id) ?? createRunVersionFromResearchRunSummary(run),
  );
  const activeVersion = runVersions.find((version) => version.id === activeRunId)
    ?? runVersions.at(-1)
    ?? null;

  if (!activeVersion) {
    return {
      ...session,
      runVersions: [],
      activeRunVersionId: null,
      activeResearchRunId: null,
    };
  }

  const hasActiveDetail = Boolean(activeVersion.isDetailLoaded);

  return {
    ...session,
    title: activeVersion.title || session.title,
    query: hasActiveDetail ? activeVersion.query : session.query,
    answer: hasActiveDetail ? activeVersion.answer : session.answer,
    launchedRequests: hasActiveDetail ? activeVersion.requests : session.launchedRequests,
    hypotheses: hasActiveDetail ? activeVersion.hypotheses : session.hypotheses,
    consultationMessages: hasActiveDetail ? activeVersion.consultationMessages : session.consultationMessages,
    runVersions,
    activeRunVersionId: activeVersion.id,
    activeResearchRunId: activeVersion.id,
    evidence: hasActiveDetail ? activeVersion.evidence : session.evidence,
    verdict: hasActiveDetail ? activeVersion.verdict : session.verdict,
    knowledgeGraph: session.knowledgeGraphRunId === activeVersion.id ? session.knowledgeGraph : null,
    knowledgeGraphRunId: session.knowledgeGraphRunId === activeVersion.id ? session.knowledgeGraphRunId : null,
    isStarted: true,
    isVerdictComplete: activeVersion.status === "completed",
    isPendingDraft: false,
    isEditingRunVersion: false,
    composerRequests: [],
  };
}

export function applyResearchRunToSession(session, run) {
  const nextVersion = createRunVersionFromResearchRun(run);
  const otherVersions = (session.runVersions ?? []).filter((version) => version.id !== nextVersion.id);

  return {
    ...session,
    title: nextVersion.title || session.title,
    query: nextVersion.query,
    answer: nextVersion.answer,
    launchedRequests: nextVersion.requests,
    hypotheses: nextVersion.hypotheses,
    consultationMessages: [],
    composerRequests: [],
    runVersions: [...otherVersions, nextVersion].sort((firstVersion, secondVersion) =>
      new Date(firstVersion.createdAt).getTime() - new Date(secondVersion.createdAt).getTime(),
    ),
    activeRunVersionId: nextVersion.id,
    activeResearchRunId: nextVersion.id,
    evidence: nextVersion.evidence,
    verdict: nextVersion.verdict,
    knowledgeGraph: session.activeResearchRunId === nextVersion.id ? session.knowledgeGraph : null,
    knowledgeGraphRunId: session.activeResearchRunId === nextVersion.id ? session.knowledgeGraphRunId : null,
    isStarted: true,
    isPendingDraft: false,
    isEditingRunVersion: false,
    isVerdictComplete: nextVersion.status === "completed",
  };
}

export function hasPendingAgent(session) {
  const availableAgents = session.availableAgents ?? [];

  return [...availableAgents, ...session.evaluation.agents].some((agent) => agent.isPendingSetup);
}

export function splitAgentsAroundCenter(agents, layoutBias = EVALUATION_SIDE_LEFT) {
  const hasRightBias = layoutBias === EVALUATION_SIDE_RIGHT;
  const leftSideCount = agents.length % 2 === 0
    ? agents.length / 2
    : hasRightBias
      ? Math.floor(agents.length / 2)
      : Math.ceil(agents.length / 2);

  return {
    leftAgents: agents.slice(0, leftSideCount),
    rightAgents: agents.slice(leftSideCount),
  };
}

export function insertEvaluationAgentAtEdge(agents, agent, edge, insertionIndex) {
  if (Number.isInteger(insertionIndex)) {
    const safeIndex = Math.min(Math.max(insertionIndex, 0), agents.length);

    return [
      ...agents.slice(0, safeIndex),
      agent,
      ...agents.slice(safeIndex),
    ];
  }

  return edge === EVALUATION_SIDE_LEFT ? [agent, ...agents] : [...agents, agent];
}

export function moveEvaluationAgentToIndex(agents, agentId, insertionIndex) {
  const currentIndex = agents.findIndex((agent) => agent.id === agentId);

  if (currentIndex === -1) {
    return agents;
  }

  const movingAgent = agents[currentIndex];
  const remainingAgents = agents.filter((agent) => agent.id !== agentId);
  const adjustedInsertionIndex = Number.isInteger(insertionIndex) && currentIndex < insertionIndex
    ? insertionIndex - 1
    : insertionIndex;
  const safeIndex = Number.isInteger(insertionIndex)
    ? Math.min(Math.max(adjustedInsertionIndex, 0), remainingAgents.length)
    : remainingAgents.length;

  return [
    ...remainingAgents.slice(0, safeIndex),
    movingAgent,
    ...remainingAgents.slice(safeIndex),
  ];
}
