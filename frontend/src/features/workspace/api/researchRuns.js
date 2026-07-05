import { getApiBaseUrl } from "../../../api/baseUrl";
import { readWorkspaceApiError } from "./readWorkspaceApiError";

function getResearchRunsUrl(chatSessionId) {
  return `${getApiBaseUrl()}/chat-sessions/${chatSessionId}/research-runs`;
}

function mapResearchRunSummary(dto) {
  return {
    id: dto.id,
    chatSessionId: dto.chat_session_id,
    parentRunId: dto.parent_run_id,
    versionNumber: dto.version_number,
    trigger: dto.trigger,
    status: dto.status,
    title: dto.title,
    inputHash: dto.input_hash,
    modelName: dto.model_name,
    hypothesisCount: dto.hypothesis_count,
    errorMessage: dto.error_message,
    startedAt: dto.started_at,
    completedAt: dto.completed_at,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function mapResearchRunProgress(dto) {
  return {
    run: mapResearchRunSummary(dto.run),
    currentStage: dto.current_stage,
    progressPercent: dto.progress_percent ?? 0,
    events: (dto.events ?? []).map((event) => ({
      id: event.id,
      runId: event.run_id,
      stage: event.stage,
      sequenceNumber: event.sequence_number,
      progressPercent: event.progress_percent,
      message: event.message,
      metadata: event.event_metadata ?? {},
      createdAt: event.created_at,
    })),
  };
}

function mapResearchRunDetail(dto) {
  return {
    ...mapResearchRunSummary(dto),
    inputs: (dto.inputs ?? []).map((input) => ({
      id: input.id,
      kind: input.kind,
      label: input.label,
      text: input.text,
      position: input.position,
      createdAt: input.created_at,
    })),
    evidence: (dto.evidence ?? []).map((item) => ({
      id: item.id,
      sessionFileId: item.session_file_id,
      chunkId: item.chunk_id,
      kind: item.kind,
      title: item.title,
      summary: item.summary,
      quote: item.quote,
      confidence: Number(item.confidence ?? 0),
      relevanceScore: item.relevance_score === null || item.relevance_score === undefined
        ? null
        : Number(item.relevance_score),
      rank: item.rank,
      metadata: item.item_metadata ?? {},
      createdAt: item.created_at,
    })),
    hypotheses: (dto.hypotheses ?? []).map((hypothesis) => ({
      id: hypothesis.id,
      position: hypothesis.position,
      title: hypothesis.title,
      statement: hypothesis.statement,
      mechanism: hypothesis.mechanism,
      kpiAlignment: hypothesis.kpi_alignment,
      feasibility: hypothesis.feasibility,
      riskProfile: hypothesis.risk_profile,
      novelty: hypothesis.novelty,
      createdAt: hypothesis.created_at,
      versions: (hypothesis.versions ?? []).map((version) => ({
        id: version.id,
        hypothesisId: version.hypothesis_id,
        versionNumber: version.version_number,
        statement: version.statement,
        changeSummary: version.change_summary,
        createdByRole: version.created_by_role,
        createdAt: version.created_at,
      })),
      evidenceLinks: (hypothesis.evidence_links ?? []).map((link) => ({
        id: link.id,
        hypothesisId: link.hypothesis_id,
        evidenceId: link.evidence_id,
        relation: link.relation,
        rationale: link.rationale,
      })),
      debateMessages: (hypothesis.debate_messages ?? []).map((message) => ({
        id: message.id,
        hypothesisId: message.hypothesis_id,
        targetVersionId: message.target_version_id,
        roundNumber: message.round_number,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
      evaluations: (hypothesis.evaluations ?? []).map((evaluation) => ({
        id: evaluation.id,
        hypothesisId: evaluation.hypothesis_id,
        userAgentId: evaluation.user_agent_id,
        evaluatorKey: evaluation.evaluator_key,
        evaluatorName: evaluation.evaluator_name,
        score: Number(evaluation.score ?? 0),
        verdict: evaluation.verdict,
        rationale: evaluation.rationale,
        riskNotes: evaluation.risk_notes,
        createdAt: evaluation.created_at,
      })),
    })),
    verdict: dto.verdict
      ? {
          id: dto.verdict.id,
          summary: dto.verdict.summary,
          recommendation: dto.verdict.recommendation,
          ranking: dto.verdict.ranking ?? [],
          nextChecks: dto.verdict.next_checks ?? [],
          createdAt: dto.verdict.created_at,
        }
      : null,
  };
}

function mapGraphNodeType(type) {
  switch (type) {
    case "input":
      return "brief";
    case "chunk":
      return "source";
    case "debate_message":
    case "hypothesis_version":
      return "evidence";
    case "next_check":
      return "verdict";
    case "run":
      return "brief";
    default:
      return type;
  }
}

function mapGraphNodeZone(type) {
  switch (type) {
    case "input":
    case "run":
      return "brief";
    case "chunk":
      return "sources";
    case "evidence":
    case "debate_message":
    case "hypothesis_version":
      return "evidence";
    case "hypothesis":
      return "hypotheses";
    case "evaluation":
    case "verdict":
    case "next_check":
      return "decision";
    default:
      return "evidence";
  }
}

function mapResearchGraph(dto) {
  return {
    runId: dto.run_id,
    zones: [
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
    ],
    nodes: (dto.nodes ?? []).map((node) => ({
      id: node.id,
      type: mapGraphNodeType(node.type),
      sourceType: node.type,
      zone: mapGraphNodeZone(node.type),
      label: node.label,
      summary: node.description ?? "",
      details: [
        node.description,
        node.metadata?.kind ? `Тип: ${node.metadata.kind}` : "",
        node.metadata?.confidence !== undefined ? `Уверенность: ${node.metadata.confidence}` : "",
        node.metadata?.score !== undefined ? `Оценка: ${node.metadata.score}` : "",
      ].filter(Boolean),
      metadata: node.metadata ?? {},
      source: node.type === "chunk"
        ? {
            title: node.label,
            excerpt: node.description ?? "",
            quote: node.description ?? "",
            contextBefore: "",
            contextAfter: "",
          }
        : null,
    })),
    edges: (dto.edges ?? []).map((edge) => ({
      id: edge.id,
      from: edge.source,
      to: edge.target,
      type: edge.type,
      label: edge.label,
      details: edge.label ?? edge.type,
      metadata: edge.metadata ?? {},
    })),
  };
}

function mapComposerRequestToInput(request, position) {
  return {
    kind: request.context?.value ?? "custom",
    label: request.context?.label ?? "Дополнительно",
    text: request.text,
    position,
  };
}

async function readJsonResponse(response, fallbackMessage) {
  if (!response.ok) {
    const detail = await readWorkspaceApiError(response, fallbackMessage);
    throw new Error(detail);
  }

  return response.json();
}

export async function listResearchRuns({ accessToken, chatSessionId, signal }) {
  const response = await fetch(getResearchRunsUrl(chatSessionId), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });
  const payload = await readJsonResponse(response, "Не удалось загрузить версии запуска");

  return {
    items: (payload.items ?? []).map(mapResearchRunSummary),
    activeRunId: payload.active_run_id,
  };
}

export async function getResearchRun({ accessToken, chatSessionId, runId, signal }) {
  const response = await fetch(`${getResearchRunsUrl(chatSessionId)}/${runId}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  return mapResearchRunDetail(await readJsonResponse(response, "Не удалось загрузить запуск"));
}

export async function getResearchRunProgress({ accessToken, chatSessionId, runId, signal }) {
  const response = await fetch(`${getResearchRunsUrl(chatSessionId)}/${runId}/progress`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  return mapResearchRunProgress(await readJsonResponse(response, "Не удалось загрузить состояние запуска"));
}

export async function createResearchRun({ accessToken, chatSessionId, requests, hypothesisCount = 3 }) {
  const response = await fetch(getResearchRunsUrl(chatSessionId), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: requests.map(mapComposerRequestToInput),
      hypothesis_count: hypothesisCount,
    }),
  });

  return mapResearchRunDetail(await readJsonResponse(response, "Не удалось запустить исследование"));
}

export async function regenerateResearchRun({ accessToken, chatSessionId, runId }) {
  const response = await fetch(`${getResearchRunsUrl(chatSessionId)}/${runId}/regenerate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  return mapResearchRunDetail(await readJsonResponse(response, "Не удалось перегенерировать запуск"));
}

export async function editResearchRun({ accessToken, chatSessionId, runId, requests }) {
  const response = await fetch(`${getResearchRunsUrl(chatSessionId)}/${runId}/edit`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: requests.map(mapComposerRequestToInput),
    }),
  });

  return mapResearchRunDetail(await readJsonResponse(response, "Не удалось создать новую ветку"));
}

export async function cancelResearchRun({ accessToken, chatSessionId, runId }) {
  const response = await fetch(`${getResearchRunsUrl(chatSessionId)}/${runId}/cancel`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return mapResearchRunSummary(await readJsonResponse(response, "Не удалось остановить запуск"));
}

export async function getResearchGraph({ accessToken, chatSessionId, runId, signal }) {
  const response = await fetch(`${getResearchRunsUrl(chatSessionId)}/${runId}/graph`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  return mapResearchGraph(await readJsonResponse(response, "Не удалось загрузить граф знаний"));
}
