import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    DebateRole,
    DocumentProcessingStatus,
    EvidenceKind,
    EvidenceRelationKind,
    ResearchInputKind,
    ResearchRunStatus,
    ResearchRunTrigger,
)


class ResearchInputRequest(BaseModel):
    kind: ResearchInputKind
    label: str
    text: str


class ResearchRunCreateRequest(BaseModel):
    inputs: list[ResearchInputRequest] = Field(min_length=1, max_length=20)
    hypothesis_count: int = Field(default=3, ge=3, le=5)


class ResearchRunRegenerateRequest(BaseModel):
    hypothesis_count: int | None = Field(default=None, ge=3, le=5)


class ResearchRunEditRequest(BaseModel):
    inputs: list[ResearchInputRequest] = Field(min_length=1, max_length=20)
    hypothesis_count: int | None = Field(default=None, ge=3, le=5)


class ResearchInputResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: ResearchInputKind
    label: str
    text: str
    position: int
    created_at: datetime


class DocumentChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_file_id: uuid.UUID
    position: int
    content: str
    content_hash: str
    token_count: int
    embedding_model: str | None = None
    embedding_dimensions: int | None = None
    embedded_at: datetime | None = None
    created_at: datetime


class EvidenceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_file_id: uuid.UUID | None
    chunk_id: uuid.UUID | None
    kind: EvidenceKind
    title: str
    summary: str
    quote: str | None
    confidence: Decimal
    item_metadata: dict[str, object]
    created_at: datetime


class HypothesisEvidenceLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hypothesis_id: uuid.UUID
    evidence_id: uuid.UUID
    relation: EvidenceRelationKind
    rationale: str | None


class HypothesisVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hypothesis_id: uuid.UUID
    version_number: int
    statement: str
    change_summary: str | None
    created_by_role: DebateRole | None
    created_at: datetime


class DebateMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hypothesis_id: uuid.UUID
    target_version_id: uuid.UUID | None
    round_number: int
    role: DebateRole
    content: str
    created_at: datetime


class EvaluationResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hypothesis_id: uuid.UUID
    user_agent_id: uuid.UUID | None
    evaluator_key: str
    evaluator_name: str
    score: Decimal
    verdict: str
    rationale: str | None
    risk_notes: str | None
    created_at: datetime


class HypothesisCandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    title: str
    statement: str
    mechanism: str
    kpi_alignment: str
    feasibility: str
    risk_profile: str
    novelty: str
    created_at: datetime
    versions: list[HypothesisVersionResponse] = Field(default_factory=list)
    evidence_links: list[HypothesisEvidenceLinkResponse] = Field(default_factory=list)
    debate_messages: list[DebateMessageResponse] = Field(default_factory=list)
    evaluations: list[EvaluationResultResponse] = Field(default_factory=list)


class JudgeVerdictResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    summary: str
    recommendation: str
    ranking: list[dict[str, object]]
    next_checks: list[str]
    created_at: datetime


class ResearchRunSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chat_session_id: uuid.UUID
    parent_run_id: uuid.UUID | None
    version_number: int
    trigger: ResearchRunTrigger
    status: ResearchRunStatus
    title: str
    input_hash: str | None
    model_name: str | None
    hypothesis_count: int
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ResearchRunListResponse(BaseModel):
    items: list[ResearchRunSummaryResponse]
    active_run_id: uuid.UUID | None


class ResearchRunDetailResponse(ResearchRunSummaryResponse):
    inputs: list[ResearchInputResponse]
    evidence: list[EvidenceItemResponse]
    hypotheses: list[HypothesisCandidateResponse]
    verdict: JudgeVerdictResponse | None


class ResearchGraphNodeResponse(BaseModel):
    id: str
    type: str
    label: str
    description: str | None = None
    metadata: dict[str, object] = Field(default_factory=dict)


class ResearchGraphEdgeResponse(BaseModel):
    id: str
    source: str
    target: str
    type: str
    label: str | None = None
    metadata: dict[str, object] = Field(default_factory=dict)


class ResearchGraphResponse(BaseModel):
    run_id: uuid.UUID
    nodes: list[ResearchGraphNodeResponse]
    edges: list[ResearchGraphEdgeResponse]


class SessionFileProcessingResponse(BaseModel):
    file_id: uuid.UUID
    processing_status: DocumentProcessingStatus
    processing_error: str | None
