const DEFAULT_GRAPH_ZONES = [
  {
    id: "brief",
    label: "Вводные",
    description: "KPI, ограничения и контекст поиска",
    tone: "blue",
  },
  {
    id: "sources",
    label: "Источники",
    description: "Документы и исходные материалы",
    tone: "amber",
  },
  {
    id: "evidence",
    label: "Evidence",
    description: "Факты, риски и противоречия",
    tone: "green",
  },
  {
    id: "hypotheses",
    label: "Гипотезы",
    description: "Проверяемые варианты решения",
    tone: "violet",
  },
  {
    id: "decision",
    label: "Оценка",
    description: "Агенты, судья и следующий шаг",
    tone: "red",
  },
];

function normalizeKnowledgeGraph(graph) {
  return {
    zones: graph?.zones?.length ? graph.zones : DEFAULT_GRAPH_ZONES,
    nodes: graph?.nodes ?? [],
    edges: graph?.edges ?? [],
  };
}

export function buildKnowledgeGraph(session) {
  return normalizeKnowledgeGraph(session?.knowledgeGraph);
}

export function getGraphNodeIdForSource(source) {
  if (source?.nodeId) {
    return source.nodeId;
  }

  if (source?.evidenceId) {
    return `evidence:${source.evidenceId}`;
  }

  if (source?.attachmentId) {
    return `chunk:${source.attachmentId}`;
  }

  return null;
}
