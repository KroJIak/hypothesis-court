const DEFAULT_SOURCE_EXCERPTS = [
  "В источнике найден сигнал, который связывает пользовательские вводные с проверяемой гипотезой и дальнейшей оценкой риска.",
  "Фрагмент используется как доказательная единица: он не заменяет вывод агента, а показывает, откуда появилась связь в графе.",
  "Материал содержит ограничение или наблюдение, которое влияет на приоритет гипотезы и маршрут следующей проверки.",
];

const DEFAULT_SOURCE_QUOTES = [
  "показатель сохраняется в целевом диапазоне после короткой серии испытаний",
  "основной риск связан не с идеей, а с переносом результата в производственный режим",
  "ограничение оборудования требует отдельной проверки перед масштабированием",
];

const EVIDENCE_SIGNAL_LABELS = {
  support: "поддерживает",
  risk: "риск",
  contradiction: "противоречит",
  constraint: "ограничивает",
  evaluation: "оценивает",
};

const REQUEST_ZONE_BY_CONTEXT = {
  kpi: "brief",
  constraints: "brief",
  context: "brief",
};

function sanitizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

function truncateText(value, maxLength) {
  const normalized = sanitizeText(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function getAttachmentTitle(attachment, index) {
  return sanitizeText(
    attachment.fileName ?? attachment.name ?? attachment.tooltip,
    `Источник ${index + 1}`,
  );
}

function getAttachmentExcerpt(attachment, index) {
  return sanitizeText(
    attachment.summary ?? attachment.description ?? attachment.tooltip,
    DEFAULT_SOURCE_EXCERPTS[index % DEFAULT_SOURCE_EXCERPTS.length],
  );
}

function createSourceQuote(attachment, index) {
  const excerpt = getAttachmentExcerpt(attachment, index);
  const fallbackQuote = DEFAULT_SOURCE_QUOTES[index % DEFAULT_SOURCE_QUOTES.length];
  const words = excerpt.split(/\s+/u).filter(Boolean);
  const quote = words.length > 7
    ? words.slice(2, Math.min(words.length, 10)).join(" ")
    : fallbackQuote;

  return {
    quote,
    contextBefore: words.length > 7 ? words.slice(0, 2).join(" ") : "Фрагмент:",
    contextAfter: words.length > 10 ? words.slice(10, 18).join(" ") : "используется как доказательная привязка в графе.",
  };
}

function createFallbackSources(session) {
  const attachments = session.attachments ?? [];

  if (attachments.length > 0) {
    return attachments.slice(0, 8).map((attachment, index) => ({
      id: `source-${attachment.id}`,
      type: "source",
      zone: "sources",
      label: getAttachmentTitle(attachment, index),
      summary: getAttachmentExcerpt(attachment, index),
      details: [
        `Тип: ${(attachment.kind ?? "file").toString().toUpperCase()}`,
        attachment.sizeBytes ? `Размер: ${Math.round(attachment.sizeBytes / 1024)} КБ` : null,
        "Статус: источник привязан к evidence-графу с возможностью перехода к фрагменту.",
      ].filter(Boolean),
      source: {
        title: getAttachmentTitle(attachment, index),
        excerpt: getAttachmentExcerpt(attachment, index),
        ...createSourceQuote(attachment, index),
      },
    }));
  }

  return [{
    id: "source-fallback-1",
    type: "source",
    zone: "sources",
    label: "Материалы сессии",
    summary: "Источник появится здесь после подключения файлов или API evidence layer.",
    details: [
      "Fallback-узел нужен, чтобы граф оставался объяснимым даже до загрузки документов.",
      "При подключении API он заменяется реальными source document и chunk nodes.",
    ],
    source: {
      title: "Материалы сессии",
      excerpt: "Доказательные фрагменты будут подставляться из API retrieval/evidence layer.",
      quote: "доказательные фрагменты будут подставляться из API",
      contextBefore: "После подключения evidence layer",
      contextAfter: "вместе с точной позицией в документе.",
    },
  }];
}

function createBriefNodes(session) {
  const requests = session.launchedRequests ?? [];

  if (requests.length > 0) {
    return requests.map((request, index) => ({
      id: `brief-${request.id}`,
      type: request.context?.value === "kpi"
        ? "kpi"
        : request.context?.value === "constraints"
          ? "constraint"
          : "brief",
      zone: REQUEST_ZONE_BY_CONTEXT[request.context?.value] ?? "brief",
      label: sanitizeText(request.context?.label, `Вводная ${index + 1}`),
      summary: truncateText(request.text, 120),
      details: [
        "Пользовательская вводная фиксирует критерий, ограничение или контекст поиска.",
        request.text,
      ],
    }));
  }

  return [{
    id: "brief-session",
    type: "brief",
    zone: "brief",
    label: "Вводные условия",
    summary: "Стартовые KPI, ограничения и контекст пока не переданы в процесс.",
    details: [
      "Этот узел будет связан с KPI, constraints и retrieval evidence после старта сессии.",
    ],
  }];
}

function createEvidenceNodes(session, sources) {
  const hypotheses = session.hypotheses ?? [];
  const evidenceCount = Math.max(4, Math.min(8, sources.length + hypotheses.length + 1));
  const evidenceSeeds = [
    {
      signal: "support",
      label: "Сигнал полезности",
      summary: "Найден фрагмент, который поддерживает измеримый эффект и делает гипотезу проверяемой.",
    },
    {
      signal: "risk",
      label: "Риск переноса",
      summary: "Есть признак, что лабораторный эффект может ослабнуть при масштабировании процесса.",
    },
    {
      signal: "constraint",
      label: "Производственное окно",
      summary: "Ограничение оборудования влияет на допустимый маршрут проверки и сроки пилота.",
    },
    {
      signal: "contradiction",
      label: "Противоречие источников",
      summary: "Часть материалов указывает на конфликт между стабильностью и целевым KPI.",
    },
    {
      signal: "support",
      label: "Бюджетный маршрут",
      summary: "Источник показывает вариант, который остается в пределах доступных ресурсов.",
    },
    {
      signal: "risk",
      label: "Неясная воспроизводимость",
      summary: "Повторяемость результата требует отдельной короткой серии испытаний.",
    },
    {
      signal: "evaluation",
      label: "Фактор оценки",
      summary: "Агентам нужно отдельно оценить стоимость, риск и реализуемость следующего шага.",
    },
    {
      signal: "support",
      label: "Следующая проверка",
      summary: "Evidence указывает на конкретный короткий эксперимент перед расширением проекта.",
    },
  ];

  return Array.from({ length: evidenceCount }, (_, index) => {
    const seed = evidenceSeeds[index % evidenceSeeds.length];
    const source = sources[index % sources.length];

    return {
      id: `evidence-${index + 1}`,
      type: "evidence",
      zone: "evidence",
      label: seed.label,
      summary: seed.summary,
      details: [
        `Сигнал: ${EVIDENCE_SIGNAL_LABELS[seed.signal] ?? seed.signal}`,
        `Источник: ${source.label}`,
        source.summary,
      ],
      signal: seed.signal,
      sourceNodeId: source.id,
      source: source.source,
    };
  });
}

function createHypothesisNodes(session) {
  const hypotheses = session.hypotheses ?? [];

  if (hypotheses.length > 0) {
    return hypotheses.map((hypothesis, index) => ({
      id: `hypothesis-${hypothesis.id}`,
      type: "hypothesis",
      zone: "hypotheses",
      label: sanitizeText(hypothesis.title, `Гипотеза ${index + 1}`),
      summary: truncateText(hypothesis.description, 150),
      details: [
        "Гипотеза собрана из evidence items и затем проходит дебаты.",
        hypothesis.description,
      ],
      processingStatus: hypothesis.processingStatus,
    }));
  }

  return [{
    id: "hypothesis-pending",
    type: "hypothesis",
    zone: "hypotheses",
    label: "Гипотезы",
    summary: "После retrieval/evidence layer здесь появятся 3-5 проверяемых вариантов.",
    details: [
      "Минимальный набор гипотез формируется из доказательных фрагментов, KPI и ограничений.",
    ],
  }];
}

function createDecisionNodes(session) {
  const agents = session.evaluation?.agents ?? [];
  const nodes = agents.slice(0, 5).map((agent) => ({
    id: `evaluation-${agent.id}`,
    type: "evaluation",
    zone: "decision",
    label: sanitizeText(agent.name, "Оценщик"),
    summary: "Независимый агент проверяет гипотезу в своей зоне ответственности.",
    details: [
      `Роль: ${sanitizeText(agent.name, "оценщик")}`,
      "Результат агента связывается с финальным вердиктом судьи.",
    ],
  }));

  nodes.push({
    id: "verdict-judge",
    type: "verdict",
    zone: "decision",
    label: "Вердикт",
    summary: session.answer
      ? truncateText(session.answer, 170)
      : "Судья соберет evidence, дебаты и оценки в итоговую рекомендацию.",
    details: [
      "Финальный узел объясняет, почему выбран следующий шаг.",
      session.answer || "Вердикт появится после обработки всех гипотез.",
    ],
  });

  return nodes;
}

function createEdges({ briefNodes, sourceNodes, evidenceNodes, hypothesisNodes, decisionNodes }) {
  const edges = [];

  sourceNodes.forEach((source, index) => {
    const evidence = evidenceNodes[index % evidenceNodes.length];
    edges.push({
      id: `${source.id}-${evidence.id}`,
      from: source.id,
      to: evidence.id,
      type: "extracts",
      label: "фрагмент",
      details: `Из "${source.label}" выделен evidence item: ${evidence.label}.`,
    });
  });

  briefNodes.forEach((brief, index) => {
    const evidence = evidenceNodes[index % evidenceNodes.length];
    edges.push({
      id: `${brief.id}-${evidence.id}`,
      from: brief.id,
      to: evidence.id,
      type: "filters",
      label: "фокусирует",
      details: `${brief.label} влияет на поиск и ранжирование доказательств.`,
    });
  });

  evidenceNodes.forEach((evidence, index) => {
    const hypothesis = hypothesisNodes[index % hypothesisNodes.length];
    edges.push({
      id: `${evidence.id}-${hypothesis.id}`,
      from: evidence.id,
      to: hypothesis.id,
      type: evidence.signal ?? "supports",
      label: EVIDENCE_SIGNAL_LABELS[evidence.signal] ?? "связь",
      details: `${evidence.label}: ${evidence.summary}`,
    });
  });

  const verdictNode = decisionNodes.find((node) => node.type === "verdict");

  hypothesisNodes.forEach((hypothesis, index) => {
    const evaluator = decisionNodes[index % Math.max(1, decisionNodes.length - 1)];

    if (evaluator && evaluator.type !== "verdict") {
      edges.push({
        id: `${hypothesis.id}-${evaluator.id}`,
        from: hypothesis.id,
        to: evaluator.id,
        type: "evaluates",
        label: "оценка",
        details: `${evaluator.label} проверяет применимость: ${hypothesis.label}.`,
      });
    }

    if (verdictNode) {
      edges.push({
        id: `${hypothesis.id}-${verdictNode.id}`,
        from: hypothesis.id,
        to: verdictNode.id,
        type: "judges",
        label: "в вердикт",
        details: `${hypothesis.label} учитывается в итоговом решении судьи.`,
      });
    }
  });

  decisionNodes
    .filter((node) => node.type !== "verdict")
    .forEach((node) => {
      if (!verdictNode) {
        return;
      }

      edges.push({
        id: `${node.id}-${verdictNode.id}`,
        from: node.id,
        to: verdictNode.id,
        type: "reports",
        label: "передает",
        details: `${node.label} передает оценку судье.`,
      });
    });

  return edges;
}

function normalizeKnowledgeGraph(graph) {
  return {
    zones: graph.zones ?? [],
    nodes: graph.nodes ?? [],
    edges: graph.edges ?? [],
  };
}

export function buildKnowledgeGraph(session) {
  if (session?.knowledgeGraph?.nodes?.length) {
    return normalizeKnowledgeGraph(session.knowledgeGraph);
  }

  const briefNodes = createBriefNodes(session);
  const sourceNodes = createFallbackSources(session);
  const evidenceNodes = createEvidenceNodes(session, sourceNodes);
  const hypothesisNodes = createHypothesisNodes(session);
  const decisionNodes = createDecisionNodes(session);
  const zones = [
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
  const nodes = [
    ...briefNodes,
    ...sourceNodes,
    ...evidenceNodes,
    ...hypothesisNodes,
    ...decisionNodes,
  ];
  const edges = createEdges({
    briefNodes,
    sourceNodes,
    evidenceNodes,
    hypothesisNodes,
    decisionNodes,
  });

  return { zones, nodes, edges };
}

export function getGraphNodeIdForSource(source) {
  if (source?.nodeId) {
    return source.nodeId;
  }

  if (source?.attachmentId) {
    return `source-${source.attachmentId}`;
  }

  return "source-fallback-1";
}
