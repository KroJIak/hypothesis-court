import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.chat_session import ChatSession
from app.models.debate_message import DebateMessage
from app.models.document_chunk import DocumentChunk
from app.models.evaluation_result import EvaluationResult
from app.models.evidence_item import EvidenceItem
from app.models.hypothesis_candidate import HypothesisCandidate
from app.models.hypothesis_evidence_link import HypothesisEvidenceLink
from app.models.hypothesis_version import HypothesisVersion
from app.models.judge_verdict import JudgeVerdict
from app.models.research_input_item import ResearchInputItem
from app.models.research_run import ResearchRun
from app.models.session_file import SessionFile
from app.models.user_agent import UserAgent


class ResearchRepository:
    def get_chat_session(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
        for_update: bool = False,
    ) -> ChatSession | None:
        stmt = select(ChatSession).where(
            ChatSession.id == chat_session_id,
            ChatSession.user_id == user_id,
            ChatSession.deleted_at.is_(None),
        )
        if for_update:
            stmt = stmt.with_for_update()
        return session.execute(stmt).scalar_one_or_none()

    def has_running_run(self, session: Session, *, chat_session_id: uuid.UUID) -> bool:
        stmt = select(func.count()).select_from(ResearchRun).where(
            ResearchRun.chat_session_id == chat_session_id,
            ResearchRun.status == "running",
        )
        return session.execute(stmt).scalar_one() > 0

    def next_version_number(self, session: Session, *, chat_session_id: uuid.UUID) -> int:
        stmt = select(func.coalesce(func.max(ResearchRun.version_number), 0) + 1).where(
            ResearchRun.chat_session_id == chat_session_id,
        )
        return int(session.execute(stmt).scalar_one())

    def create_run(self, session: Session, run: ResearchRun) -> ResearchRun:
        session.add(run)
        session.flush()
        return run

    def create_input_item(self, session: Session, item: ResearchInputItem) -> ResearchInputItem:
        session.add(item)
        session.flush()
        return item

    def list_runs(self, session: Session, *, user_id: uuid.UUID, chat_session_id: uuid.UUID) -> list[ResearchRun]:
        stmt = (
            select(ResearchRun)
            .where(
                ResearchRun.user_id == user_id,
                ResearchRun.chat_session_id == chat_session_id,
            )
            .order_by(ResearchRun.version_number.asc())
        )
        return session.execute(stmt).scalars().all()

    def get_run(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
        run_id: uuid.UUID,
        for_update: bool = False,
    ) -> ResearchRun | None:
        stmt = select(ResearchRun).where(
            ResearchRun.id == run_id,
            ResearchRun.user_id == user_id,
            ResearchRun.chat_session_id == chat_session_id,
        )
        if for_update:
            stmt = stmt.with_for_update()
        return session.execute(stmt).scalar_one_or_none()

    def get_active_run(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
    ) -> ResearchRun | None:
        chat_session = self.get_chat_session(session, user_id=user_id, chat_session_id=chat_session_id)
        if chat_session is None or chat_session.active_research_run_id is None:
            return None
        return self.get_run(
            session,
            user_id=user_id,
            chat_session_id=chat_session_id,
            run_id=chat_session.active_research_run_id,
        )

    def list_active_files(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
    ) -> list[SessionFile]:
        stmt = (
            select(SessionFile)
            .where(
                SessionFile.user_id == user_id,
                SessionFile.chat_session_id == chat_session_id,
                SessionFile.deleted_at.is_(None),
            )
            .order_by(SessionFile.created_at.asc(), SessionFile.id.asc())
        )
        return session.execute(stmt).scalars().all()

    def list_chunks_for_file(self, session: Session, *, session_file_id: uuid.UUID) -> list[DocumentChunk]:
        stmt = (
            select(DocumentChunk)
            .where(DocumentChunk.session_file_id == session_file_id)
            .order_by(DocumentChunk.position.asc())
        )
        return session.execute(stmt).scalars().all()

    def create_chunk(self, session: Session, chunk: DocumentChunk) -> DocumentChunk:
        session.add(chunk)
        session.flush()
        return chunk

    def create_evidence(self, session: Session, evidence: EvidenceItem) -> EvidenceItem:
        session.add(evidence)
        session.flush()
        return evidence

    def create_hypothesis(self, session: Session, hypothesis: HypothesisCandidate) -> HypothesisCandidate:
        session.add(hypothesis)
        session.flush()
        return hypothesis

    def create_hypothesis_evidence_link(
        self,
        session: Session,
        link: HypothesisEvidenceLink,
    ) -> HypothesisEvidenceLink:
        session.add(link)
        session.flush()
        return link

    def create_hypothesis_version(self, session: Session, version: HypothesisVersion) -> HypothesisVersion:
        session.add(version)
        session.flush()
        return version

    def create_debate_message(self, session: Session, message: DebateMessage) -> DebateMessage:
        session.add(message)
        session.flush()
        return message

    def list_selected_agents(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
    ) -> list[UserAgent]:
        from app.models.chat_session_agent import ChatSessionAgent

        query = (
            select(UserAgent)
            .join(ChatSessionAgent, ChatSessionAgent.agent_id == UserAgent.id)
            .where(
                ChatSessionAgent.user_id == user_id,
                ChatSessionAgent.chat_session_id == chat_session_id,
                UserAgent.deleted_at.is_(None),
            )
            .order_by(ChatSessionAgent.position.asc(), ChatSessionAgent.created_at.asc())
        )
        return session.execute(query).scalars().all()

    def create_evaluation_result(self, session: Session, result: EvaluationResult) -> EvaluationResult:
        session.add(result)
        session.flush()
        return result

    def create_judge_verdict(self, session: Session, verdict: JudgeVerdict) -> JudgeVerdict:
        session.add(verdict)
        session.flush()
        return verdict

    def list_input_items(self, session: Session, *, run_id: uuid.UUID) -> list[ResearchInputItem]:
        stmt = (
            select(ResearchInputItem)
            .where(ResearchInputItem.run_id == run_id)
            .order_by(ResearchInputItem.position.asc())
        )
        return session.execute(stmt).scalars().all()

    def list_evidence(self, session: Session, *, run_id: uuid.UUID) -> list[EvidenceItem]:
        stmt = select(EvidenceItem).where(EvidenceItem.run_id == run_id).order_by(EvidenceItem.created_at.asc())
        return session.execute(stmt).scalars().all()

    def list_hypotheses(self, session: Session, *, run_id: uuid.UUID) -> list[HypothesisCandidate]:
        stmt = (
            select(HypothesisCandidate)
            .where(HypothesisCandidate.run_id == run_id)
            .order_by(HypothesisCandidate.position.asc())
        )
        return session.execute(stmt).scalars().all()

    def list_hypothesis_versions(
        self,
        session: Session,
        *,
        hypothesis_ids: list[uuid.UUID],
    ) -> list[HypothesisVersion]:
        if not hypothesis_ids:
            return []
        stmt = (
            select(HypothesisVersion)
            .where(HypothesisVersion.hypothesis_id.in_(hypothesis_ids))
            .order_by(HypothesisVersion.hypothesis_id.asc(), HypothesisVersion.version_number.asc())
        )
        return session.execute(stmt).scalars().all()

    def list_evidence_links(
        self,
        session: Session,
        *,
        hypothesis_ids: list[uuid.UUID],
    ) -> list[HypothesisEvidenceLink]:
        if not hypothesis_ids:
            return []
        stmt = select(HypothesisEvidenceLink).where(HypothesisEvidenceLink.hypothesis_id.in_(hypothesis_ids))
        return session.execute(stmt).scalars().all()

    def list_debate_messages(
        self,
        session: Session,
        *,
        hypothesis_ids: list[uuid.UUID],
    ) -> list[DebateMessage]:
        if not hypothesis_ids:
            return []
        stmt = (
            select(DebateMessage)
            .where(DebateMessage.hypothesis_id.in_(hypothesis_ids))
            .order_by(DebateMessage.hypothesis_id.asc(), DebateMessage.round_number.asc(), DebateMessage.created_at.asc())
        )
        return session.execute(stmt).scalars().all()

    def list_evaluation_results(self, session: Session, *, run_id: uuid.UUID) -> list[EvaluationResult]:
        stmt = (
            select(EvaluationResult)
            .where(EvaluationResult.run_id == run_id)
            .order_by(EvaluationResult.hypothesis_id.asc(), EvaluationResult.evaluator_name.asc())
        )
        return session.execute(stmt).scalars().all()

    def get_judge_verdict(self, session: Session, *, run_id: uuid.UUID) -> JudgeVerdict | None:
        stmt = select(JudgeVerdict).where(JudgeVerdict.run_id == run_id)
        return session.execute(stmt).scalar_one_or_none()

    def search_run_content(
        self,
        session: Session,
        *,
        user_id: uuid.UUID,
        query: str,
        limit: int,
    ) -> list[uuid.UUID]:
        pattern = f"%{query}%"
        stmt = (
            select(ResearchRun.chat_session_id)
            .outerjoin(ResearchInputItem, ResearchInputItem.run_id == ResearchRun.id)
            .outerjoin(HypothesisCandidate, HypothesisCandidate.run_id == ResearchRun.id)
            .outerjoin(EvidenceItem, EvidenceItem.run_id == ResearchRun.id)
            .where(
                ResearchRun.user_id == user_id,
                or_(
                    ResearchRun.title.ilike(pattern),
                    ResearchInputItem.text.ilike(pattern),
                    HypothesisCandidate.statement.ilike(pattern),
                    EvidenceItem.summary.ilike(pattern),
                ),
            )
            .distinct()
            .limit(limit)
        )
        return list(session.execute(stmt).scalars().all())
