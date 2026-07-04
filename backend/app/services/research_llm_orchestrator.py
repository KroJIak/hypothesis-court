import json
import re
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from app.core.settings import Settings
from app.models.enums import DebateRole, EvidenceKind, EvidenceRelationKind
from app.prompts.research_prompts import (
    DEBATE_PROMPT,
    EVALUATION_PROMPT,
    EVIDENCE_EXTRACTION_PROMPT,
    HYPOTHESIS_GENERATION_PROMPT,
    JUDGE_PROMPT,
    RESEARCH_JSON_SYSTEM_PROMPT,
)
from app.services.exceptions import ValidationError
from app.services.model_provider_settings_service import ModelProviderSettingsService

_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


@dataclass(frozen=True)
class SourceFragment:
    source_index: int
    session_file_id: str | None
    chunk_id: str | None
    title: str
    text: str
    score: float


@dataclass(frozen=True)
class EvidenceDraft:
    source_index: int | None
    kind: EvidenceKind
    title: str
    summary: str
    quote: str | None
    confidence: Decimal
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class HypothesisEvidenceDraft:
    evidence_index: int
    relation: EvidenceRelationKind
    rationale: str | None


@dataclass(frozen=True)
class HypothesisDraft:
    title: str
    statement: str
    mechanism: str
    kpi_alignment: str
    feasibility: str
    risk_profile: str
    novelty: str
    evidence_links: list[HypothesisEvidenceDraft]


@dataclass(frozen=True)
class DebateDraft:
    messages: list[tuple[DebateRole, str]]
    refined_statement: str
    change_summary: str


@dataclass(frozen=True)
class EvaluationDraft:
    score: Decimal
    verdict: str
    rationale: str
    risk_notes: str


@dataclass(frozen=True)
class JudgeDraft:
    summary: str
    recommendation: str
    ranking: list[dict[str, object]]
    next_checks: list[str]


class ResearchLlmOrchestrator:
    def __init__(
        self,
        *,
        provider_settings_service: ModelProviderSettingsService,
        settings: Settings,
    ) -> None:
        self._provider_settings_service = provider_settings_service
        self._settings = settings

    def extract_evidence(
        self,
        *,
        research_brief: str,
        fragments: list[SourceFragment],
        limit: int = 12,
    ) -> list[EvidenceDraft]:
        payload = {
            "research_brief": research_brief,
            "sources": [self._fragment_payload(fragment) for fragment in fragments],
            "max_items": limit,
        }
        data = self._complete_json(instruction=EVIDENCE_EXTRACTION_PROMPT, payload=payload, temperature=0.1)
        items = self._as_list(data.get("items"))
        drafts: list[EvidenceDraft] = []
        for raw_item in items[:limit]:
            if not isinstance(raw_item, dict):
                continue
            kind = self._parse_evidence_kind(raw_item.get("kind"))
            summary = self._text(raw_item.get("summary"), limit=2000)
            title = self._text(raw_item.get("title"), limit=200) or self._short_text(summary, 120)
            if not summary or not title:
                continue
            source_index = self._optional_int(raw_item.get("source_index"))
            drafts.append(
                EvidenceDraft(
                    source_index=source_index,
                    kind=kind,
                    title=title,
                    summary=summary,
                    quote=self._optional_text(raw_item.get("quote"), limit=2000),
                    confidence=self._decimal_unit(raw_item.get("confidence"), default="0.6500"),
                    metadata={"source": "llm", "retrieval_score": self._fragment_score(fragments, source_index)},
                )
            )
        if not drafts:
            raise ValidationError("Модель не смогла выделить evidence из входных данных")
        return drafts

    def generate_hypotheses(
        self,
        *,
        research_brief: str,
        evidence: list[EvidenceDraft],
        hypothesis_count: int,
    ) -> list[HypothesisDraft]:
        payload = {
            "research_brief": research_brief,
            "hypothesis_count": hypothesis_count,
            "evidence": [self._evidence_payload(index, item) for index, item in enumerate(evidence)],
        }
        data = self._complete_json(instruction=HYPOTHESIS_GENERATION_PROMPT, payload=payload, temperature=0.35)
        items = self._as_list(data.get("hypotheses"))
        hypotheses: list[HypothesisDraft] = []
        for raw_item in items[:hypothesis_count]:
            if not isinstance(raw_item, dict):
                continue
            title = self._text(raw_item.get("title"), limit=120)
            statement = self._text(raw_item.get("statement"), limit=3000)
            if not title or not statement:
                continue
            links = self._parse_hypothesis_links(raw_item.get("evidence_links"), evidence_count=len(evidence))
            if not links and evidence:
                links = [HypothesisEvidenceDraft(evidence_index=0, relation=EvidenceRelationKind.SUPPORTS, rationale=None)]
            hypotheses.append(
                HypothesisDraft(
                    title=title,
                    statement=statement,
                    mechanism=self._text(raw_item.get("mechanism"), limit=3000),
                    kpi_alignment=self._text(raw_item.get("kpi_alignment"), limit=2000),
                    feasibility=self._text(raw_item.get("feasibility"), limit=2000),
                    risk_profile=self._text(raw_item.get("risk_profile"), limit=2000),
                    novelty=self._text(raw_item.get("novelty"), limit=2000),
                    evidence_links=links,
                )
            )
        if len(hypotheses) < hypothesis_count:
            raise ValidationError("Модель вернула недостаточно гипотез")
        return hypotheses

    def debate_hypothesis(
        self,
        *,
        hypothesis: HypothesisDraft,
        evidence: list[EvidenceDraft],
        round_number: int,
    ) -> DebateDraft:
        payload = {
            "round_number": round_number,
            "hypothesis": self._hypothesis_payload(hypothesis),
            "linked_evidence": [self._evidence_payload(index, item) for index, item in enumerate(evidence)],
        }
        data = self._complete_json(instruction=DEBATE_PROMPT, payload=payload, temperature=0.25)
        messages: list[tuple[DebateRole, str]] = []
        for raw_item in self._as_list(data.get("messages")):
            if not isinstance(raw_item, dict):
                continue
            role = self._parse_debate_role(raw_item.get("role"))
            content = self._text(raw_item.get("content"), limit=4000)
            if content:
                messages.append((role, content))
        refined_statement = self._text(data.get("refined_statement"), limit=3000) or hypothesis.statement
        change_summary = self._text(data.get("change_summary"), limit=2000)
        if len(messages) < 3:
            raise ValidationError("Модель вернула неполный debate loop")
        return DebateDraft(messages=messages[:3], refined_statement=refined_statement, change_summary=change_summary)

    def evaluate_hypothesis(
        self,
        *,
        evaluator_key: str,
        evaluator_name: str,
        evaluator_prompt: str | None,
        hypothesis: HypothesisDraft,
        refined_statement: str,
        evidence: list[EvidenceDraft],
    ) -> EvaluationDraft:
        payload = {
            "evaluator": {
                "key": evaluator_key,
                "name": evaluator_name,
                "system_prompt": evaluator_prompt,
            },
            "hypothesis": self._hypothesis_payload(hypothesis) | {"refined_statement": refined_statement},
            "evidence": [self._evidence_payload(index, item) for index, item in enumerate(evidence)],
        }
        data = self._complete_json(instruction=EVALUATION_PROMPT, payload=payload, temperature=0.2)
        return EvaluationDraft(
            score=self._decimal_percent(data.get("score"), default="50.00"),
            verdict=self._required_text(data.get("verdict"), limit=2000, field_name="verdict"),
            rationale=self._text(data.get("rationale"), limit=3000),
            risk_notes=self._text(data.get("risk_notes"), limit=3000),
        )

    def judge(
        self,
        *,
        research_brief: str,
        hypotheses: list[HypothesisDraft],
        refined_statements: list[str],
        evidence: list[EvidenceDraft],
        evaluations: list[dict[str, object]],
    ) -> JudgeDraft:
        payload = {
            "research_brief": research_brief,
            "hypotheses": [
                self._hypothesis_payload(hypothesis) | {"refined_statement": refined_statements[index]}
                for index, hypothesis in enumerate(hypotheses)
            ],
            "evidence": [self._evidence_payload(index, item) for index, item in enumerate(evidence)],
            "evaluations": evaluations,
        }
        data = self._complete_json(instruction=JUDGE_PROMPT, payload=payload, temperature=0.2)
        ranking = [item for item in self._as_list(data.get("ranking")) if isinstance(item, dict)]
        next_checks = [
            self._text(item, limit=500)
            for item in self._as_list(data.get("next_checks"))
            if self._text(item, limit=500)
        ]
        return JudgeDraft(
            summary=self._required_text(data.get("summary"), limit=4000, field_name="summary"),
            recommendation=self._required_text(data.get("recommendation"), limit=4000, field_name="recommendation"),
            ranking=ranking,
            next_checks=next_checks[:10],
        )

    def _complete_json(self, *, instruction: str, payload: dict[str, object], temperature: float) -> dict[str, Any]:
        client, model = self._provider_settings_service.get_model_client(self._settings)
        content = client.create_chat_completion(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": RESEARCH_JSON_SYSTEM_PROMPT},
                {"role": "user", "content": f"{instruction}\n\nDATA:\n{json.dumps(payload, ensure_ascii=False)}"},
            ],
        )
        return self._parse_json_object(content)

    @staticmethod
    def _parse_json_object(content: str) -> dict[str, Any]:
        cleaned = content.strip()
        match = _JSON_BLOCK_RE.fullmatch(cleaned)
        if match is not None:
            cleaned = match.group(1).strip()
        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise ValidationError("Модель вернула невалидный JSON") from exc
        if not isinstance(payload, dict):
            raise ValidationError("Модель вернула JSON не того формата")
        return payload

    @staticmethod
    def _fragment_payload(fragment: SourceFragment) -> dict[str, object]:
        return {
            "source_index": fragment.source_index,
            "session_file_id": fragment.session_file_id,
            "chunk_id": fragment.chunk_id,
            "title": fragment.title,
            "score": fragment.score,
            "text": fragment.text,
        }

    @staticmethod
    def _fragment_score(fragments: list[SourceFragment], source_index: int | None) -> float | None:
        if source_index is None or source_index < 0 or source_index >= len(fragments):
            return None
        return fragments[source_index].score

    @staticmethod
    def _evidence_payload(index: int, item: EvidenceDraft) -> dict[str, object]:
        return {
            "evidence_index": index,
            "kind": item.kind.value,
            "title": item.title,
            "summary": item.summary,
            "quote": item.quote,
            "confidence": float(item.confidence),
        }

    @staticmethod
    def _hypothesis_payload(hypothesis: HypothesisDraft) -> dict[str, object]:
        return {
            "title": hypothesis.title,
            "statement": hypothesis.statement,
            "mechanism": hypothesis.mechanism,
            "kpi_alignment": hypothesis.kpi_alignment,
            "feasibility": hypothesis.feasibility,
            "risk_profile": hypothesis.risk_profile,
            "novelty": hypothesis.novelty,
            "evidence_links": [
                {
                    "evidence_index": link.evidence_index,
                    "relation": link.relation.value,
                    "rationale": link.rationale,
                }
                for link in hypothesis.evidence_links
            ],
        }

    @staticmethod
    def _parse_hypothesis_links(raw_links: object, *, evidence_count: int) -> list[HypothesisEvidenceDraft]:
        links: list[HypothesisEvidenceDraft] = []
        for raw_link in ResearchLlmOrchestrator._as_list(raw_links):
            if not isinstance(raw_link, dict):
                continue
            evidence_index = ResearchLlmOrchestrator._optional_int(raw_link.get("evidence_index"))
            if evidence_index is None or evidence_index < 0 or evidence_index >= evidence_count:
                continue
            links.append(
                HypothesisEvidenceDraft(
                    evidence_index=evidence_index,
                    relation=ResearchLlmOrchestrator._parse_relation(raw_link.get("relation")),
                    rationale=ResearchLlmOrchestrator._optional_text(raw_link.get("rationale"), limit=1000),
                )
            )
        return links

    @staticmethod
    def _parse_evidence_kind(raw_value: object) -> EvidenceKind:
        try:
            return EvidenceKind(str(raw_value))
        except ValueError:
            return EvidenceKind.UNKNOWN

    @staticmethod
    def _parse_relation(raw_value: object) -> EvidenceRelationKind:
        try:
            return EvidenceRelationKind(str(raw_value))
        except ValueError:
            return EvidenceRelationKind.SUPPORTS

    @staticmethod
    def _parse_debate_role(raw_value: object) -> DebateRole:
        try:
            return DebateRole(str(raw_value))
        except ValueError:
            raise ValidationError("Модель вернула неизвестную роль debate")

    @staticmethod
    def _as_list(raw_value: object) -> list[object]:
        return raw_value if isinstance(raw_value, list) else []

    @staticmethod
    def _optional_int(raw_value: object) -> int | None:
        if isinstance(raw_value, int):
            return raw_value
        if isinstance(raw_value, str) and raw_value.strip().isdigit():
            return int(raw_value)
        return None

    @staticmethod
    def _text(raw_value: object, *, limit: int) -> str:
        if raw_value is None:
            return ""
        normalized = re.sub(r"\s+", " ", str(raw_value)).strip()
        if len(normalized) <= limit:
            return normalized
        return normalized[: max(0, limit - 3)].rstrip() + "..."

    @staticmethod
    def _optional_text(raw_value: object, *, limit: int) -> str | None:
        value = ResearchLlmOrchestrator._text(raw_value, limit=limit)
        return value or None

    @staticmethod
    def _required_text(raw_value: object, *, limit: int, field_name: str) -> str:
        value = ResearchLlmOrchestrator._text(raw_value, limit=limit)
        if not value:
            raise ValidationError(f"Модель не вернула обязательное поле {field_name}")
        return value

    @staticmethod
    def _short_text(raw_value: str, limit: int) -> str:
        return raw_value if len(raw_value) <= limit else raw_value[: max(0, limit - 3)].rstrip() + "..."

    @staticmethod
    def _decimal_unit(raw_value: object, *, default: str) -> Decimal:
        try:
            value = Decimal(str(raw_value))
        except Exception:
            value = Decimal(default)
        return max(Decimal("0.0000"), min(Decimal("1.0000"), value)).quantize(Decimal("0.0001"))

    @staticmethod
    def _decimal_percent(raw_value: object, *, default: str) -> Decimal:
        try:
            value = Decimal(str(raw_value))
        except Exception:
            value = Decimal(default)
        return max(Decimal("0.00"), min(Decimal("100.00"), value)).quantize(Decimal("0.01"))
