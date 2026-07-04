import {
  DEFAULT_EVALUATION_AGENT_STATUS,
  EVALUATION_SIDE_LEFT,
  EVALUATION_SIDE_RIGHT,
} from "../constants";
import { getSequentialProcessingStatus } from "../utils/processingStatus";

export function sortAvailableAgents(agents) {
  return [...agents].sort((firstAgent, secondAgent) => {
    if (firstAgent.isPendingSetup !== secondAgent.isPendingSetup) {
      return firstAgent.isPendingSetup ? -1 : 1;
    }

    if (firstAgent.isCustom !== secondAgent.isCustom) {
      return firstAgent.isCustom ? -1 : 1;
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

export function createHypothesesFromRequests(requests, count = 3) {
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

export function createAnswerFromRequests(requests) {
  const requestSummary = requests
    .slice(0, 3)
    .map((request) => `${request.context.label}: ${request.text}`)
    .join(" ");

  return [
    "Вердикт: гипотезы прошли полный цикл дебатов и оценки, поэтому запускать следующий шаг можно только как ограниченную проверку с заранее заданными критериями остановки.",
    requestSummary
      ? `Ключевые вводные учтены: ${requestSummary}.`
      : "Ключевые вводные пока заданы кратко, поэтому решение стоит считать предварительным.",
    "Самая сильная часть кейса - возможность быстро проверить эффект без перестройки всего процесса. Самый слабый участок - риск, что лабораторный выигрыш исчезнет при переносе в повторяемый производственный режим.",
    "Рекомендация: собрать короткий пилот, закрепить измеримый KPI, отдельно проверить ограничения и вернуться к расширенному обсуждению только после фактических данных.",
  ].join(" ");
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

export function createConsultationAnswer(question, session) {
  const hypothesisCount = session.hypotheses?.length ?? 0;
  const focus = hypothesisCount > 0
    ? `Опираюсь на ${hypothesisCount} выдвинутые гипотезы и уже вынесенный вердикт.`
    : "Опираюсь на текущие вводные и предварительный вердикт.";

  return [
    focus,
    `По вопросу: "${question.trim()}"`,
    "Короткий ответ: уточните, какая гипотеза важнее для следующего действия, и проверяйте её через самый дешёвый измеримый эксперимент. Если вопрос касается риска, сначала смотрите на ограничения и данные, которые могут быстро опровергнуть гипотезу.",
  ].join(" ");
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
