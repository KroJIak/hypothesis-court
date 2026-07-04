import math
from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.settings import Settings
from app.models.document_chunk import DocumentChunk
from app.services.model_provider_settings_service import ModelProviderSettingsService
from app.services.research_llm_orchestrator import SourceFragment

_MAX_EMBEDDING_BATCH_SIZE = 64


@dataclass(frozen=True)
class RetrievalResult:
    chunk: DocumentChunk
    score: float


class ResearchRetrievalService:
    def __init__(
        self,
        *,
        provider_settings_service: ModelProviderSettingsService,
        settings: Settings,
    ) -> None:
        self._provider_settings_service = provider_settings_service
        self._settings = settings

    def ensure_chunk_embeddings(self, chunks: list[DocumentChunk]) -> None:
        for chunk in chunks:
            if chunk.embedding and chunk.embedding_vector is None and len(chunk.embedding) == 3072:
                chunk.embedding_vector = chunk.embedding
        pending_chunks = [chunk for chunk in chunks if not chunk.embedding]
        if not pending_chunks:
            return
        client, model = self._provider_settings_service.get_embedding_client(self._settings)
        for start in range(0, len(pending_chunks), _MAX_EMBEDDING_BATCH_SIZE):
            batch = pending_chunks[start : start + _MAX_EMBEDDING_BATCH_SIZE]
            vectors = client.create_embeddings(model=model, inputs=[chunk.content for chunk in batch])
            for chunk, vector in zip(batch, vectors, strict=True):
                chunk.embedding = vector
                chunk.embedding_vector = vector if len(vector) == 3072 else None
                chunk.embedding_model = model
                chunk.embedding_dimensions = len(vector)
                chunk.embedded_at = datetime.now(UTC)

    def embed_query(self, query: str) -> list[float]:
        client, model = self._provider_settings_service.get_embedding_client(self._settings)
        return client.create_embeddings(model=model, inputs=[query])[0]

    def retrieve(self, *, query: str, chunks: list[DocumentChunk], limit: int) -> list[RetrievalResult]:
        if not chunks:
            return []
        self.ensure_chunk_embeddings(chunks)
        query_vector = self.embed_query(query)
        return self.rank_with_query_vector(query_vector=query_vector, chunks=chunks, limit=limit)

    def rank_with_query_vector(
        self,
        *,
        query_vector: list[float],
        chunks: list[DocumentChunk],
        limit: int,
    ) -> list[RetrievalResult]:
        scored = [
            RetrievalResult(chunk=chunk, score=self._cosine_similarity(query_vector, chunk.embedding or []))
            for chunk in chunks
            if chunk.embedding
        ]
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:limit]

    @staticmethod
    def to_source_fragments(results: list[RetrievalResult]) -> list[SourceFragment]:
        fragments: list[SourceFragment] = []
        for index, result in enumerate(results):
            fragments.append(
                SourceFragment(
                    source_index=index,
                    session_file_id=str(result.chunk.session_file_id),
                    chunk_id=str(result.chunk.id),
                    title=f"Фрагмент {result.chunk.position + 1}",
                    text=result.chunk.content,
                    score=round(result.score, 6),
                )
            )
        return fragments

    @staticmethod
    def _cosine_similarity(left: list[float], right: list[float]) -> float:
        if not left or not right or len(left) != len(right):
            return 0.0
        dot = sum(a * b for a, b in zip(left, right, strict=True))
        left_norm = math.sqrt(sum(value * value for value in left))
        right_norm = math.sqrt(sum(value * value for value in right))
        if left_norm == 0 or right_norm == 0:
            return 0.0
        return dot / (left_norm * right_norm)
