import {
  DEFAULT_EVALUATION_AGENT_STATUS,
  EVALUATION_SIDE_LEFT,
  EVALUATION_SIDE_RIGHT,
  PENDING_AGENT_NAME,
} from "../constants";

export function sortAvailableAgents(agents) {
  return [...agents].sort((firstAgent, secondAgent) => {
    if (firstAgent.isPendingSetup !== secondAgent.isPendingSetup) {
      return firstAgent.isPendingSetup ? -1 : 1;
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
  return {
    ...session,
    composerRequests: session.composerRequests ?? [],
    launchedRequests: session.launchedRequests ?? [],
    hypotheses: session.hypotheses ?? [],
    availableAgents: getInitialAvailableAgents(session, paletteAgents),
  };
}

export function createDraftWorkspaceSession(baseSession, paletteAgents, newChatId) {
  const availableAgents = baseSession.availableAgents ?? getInitialAvailableAgents(baseSession, paletteAgents);

  return {
    ...baseSession,
    id: newChatId,
    isPendingDraft: true,
    title: "Новый чат",
    query: "Новая гипотеза появится здесь после отправки запроса.",
    answer:
      "После подключения API здесь появится вердикт судьи и итоговая рекомендация по собранной сцене.",
    attachments: [],
    composerRequests: [],
    launchedRequests: [],
    hypotheses: [],
    availableAgents: sortAvailableAgents(
      [
        ...paletteAgents.filter((agent) => !agent.isEmpty),
        ...availableAgents,
        ...baseSession.evaluation.agents,
      ].filter((agent, index, agents) => agents.findIndex((item) => item.id === agent.id) === index),
    ),
    evaluation: {
      ...baseSession.evaluation,
      layoutBias: undefined,
      agents: [],
    },
  };
}

export function createEvaluationAgent(agent) {
  return {
    ...agent,
    status: agent.status ?? DEFAULT_EVALUATION_AGENT_STATUS,
  };
}

export function createPendingAgent() {
  return {
    id: `pending-agent-${Date.now()}`,
    name: PENDING_AGENT_NAME,
    variant: "empty",
    isEmpty: true,
    isPendingSetup: true,
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

export function createHypothesesFromRequests(requests, count = 4) {
  const requestSummary = requests
    .slice(0, 2)
    .map((request) => request.text)
    .join("; ");
  const hypothesisSeeds = [
    "Сузить проверку до режима, где целевой KPI достигается без расширения производственного окна.",
    "Сравнить базовый маршрут с более дешёвой заменой критического этапа и оценить потерю качества.",
    "Проверить, не скрывается ли основной эффект в комбинации ограничений, а не в отдельном параметре.",
    "Выделить короткий пилот, который подтвердит реализуемость до вложений в масштабирование.",
    "Отдельно протестировать слабое место, которое может обнулить выигрыш при переносе в производство.",
  ];

  return hypothesisSeeds.slice(0, count).map((description, index) => ({
    id: `generated-hypothesis-${index + 1}`,
    title: `Гипотеза ${index + 1}`,
    description: requestSummary ? `${description} Исходный фокус: ${requestSummary}.` : description,
  }));
}

export function hasPendingAgent(session) {
  const availableAgents = session.availableAgents ?? [];

  return [...availableAgents, ...session.evaluation.agents].some((agent) => agent.isPendingSetup);
}

export function matchesChatSearch(session, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [session.title, session.query]
    .filter(Boolean)
    .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
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

export function insertEvaluationAgentAtEdge(agents, agent, edge) {
  return edge === EVALUATION_SIDE_LEFT ? [agent, ...agents] : [...agents, agent];
}
