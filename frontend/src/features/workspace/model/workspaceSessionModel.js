import {
  DEFAULT_EVALUATION_AGENT_STATUS,
  EVALUATION_SIDE_LEFT,
  EVALUATION_SIDE_RIGHT,
  PENDING_AGENT_NAME,
} from "../constants";
import { getSequentialProcessingStatus } from "../utils/processingStatus";

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

export function reorderAvailableAgents(agents, movingAgentId, targetAgentId, placement = "before") {
  if (movingAgentId === targetAgentId) {
    return agents;
  }

  const movingAgent = agents.find((agent) => agent.id === movingAgentId);
  const targetAgent = agents.find((agent) => agent.id === targetAgentId);

  if (!movingAgent || !targetAgent || movingAgent.isEmpty || targetAgent.isEmpty) {
    return agents;
  }

  const agentsWithoutMoving = agents.filter((agent) => agent.id !== movingAgentId);
  const targetIndex = agentsWithoutMoving.findIndex((agent) => agent.id === targetAgentId);

  if (targetIndex === -1) {
    return agents;
  }

  const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;

  return [
    ...agentsWithoutMoving.slice(0, insertIndex),
    movingAgent,
    ...agentsWithoutMoving.slice(insertIndex),
  ];
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

export function createWorkspaceSessionFromChatSession(chatSession, templateSessions, paletteAgents) {
  const templateSession = getTemplateSession(chatSession.id, templateSessions);
  const session = chatSession.isStarted
    ? templateSession
    : createUnstartedSessionTemplate(templateSession, paletteAgents);

  return createWorkspaceSession(
    {
      ...applyChatSessionMetadata(session, chatSession),
      attachments: [],
    },
    paletteAgents,
  );
}

function createUnstartedSessionTemplate(templateSession, paletteAgents) {
  return {
    ...templateSession,
    query: "Новая гипотеза появится здесь после отправки запроса.",
    answer: "",
    attachments: [],
    composerRequests: [],
    launchedRequests: [],
    hypotheses: [],
    availableAgents: sortAvailableAgents(paletteAgents.filter((agent) => !agent.isEmpty)),
    evaluation: {
      ...templateSession.evaluation,
      layoutBias: undefined,
      agents: [],
    },
  };
}

function getTemplateSession(chatSessionId, templateSessions) {
  if (templateSessions.length === 0) {
    throw new Error("At least one workspace session template is required.");
  }

  const hash = [...chatSessionId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return templateSessions[hash % templateSessions.length];
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
    processingStatus: getSequentialProcessingStatus(index, count),
  }));
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

export function insertEvaluationAgentAtEdge(agents, agent, edge) {
  return edge === EVALUATION_SIDE_LEFT ? [agent, ...agents] : [...agents, agent];
}
