"""
Continuity OS · RAG Retrieval Engine
Implements:
- Document ingestion with Recursive or Docling Structural Chunking
- Deterministic 64-dim/128-dim normalized embedding generator
- Cosine similarity vector search
- BM25/keyword hybrid retrieval
- SQLite storage persistence
"""

import os
import sqlite3
import math
import hashlib
import json
from typing import List, Dict, Any, Optional
from rag.chunker import RecursiveChunker, StructuralSemanticChunker
from guardrails.schemas import RAGChunk


def compute_deterministic_embedding(text: str, dimensions: int = 64) -> List[float]:
    """
    Computes a deterministic normalized embedding vector using token hashing.
    Provides immediate zero-dependency vector embeddings for tests and offline RAG.
    Can be replaced or augmented with external embedding providers (OpenAI, Voyage, Cohere).
    """
    vector = [0.0] * dimensions
    tokens = text.lower().split()
    if not tokens:
        return vector

    for t in tokens:
        h = int(hashlib.sha256(t.encode("utf-8")).hexdigest(), 16)
        idx = h % dimensions
        weight = 1.0 + (h % 10) / 10.0
        vector[idx] += weight

    norm = math.sqrt(sum(v * v for v in vector))
    if norm > 0:
        vector = [round(v / norm, 5) for v in vector]
    return vector


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    if len(vec_a) != len(vec_b) or not vec_a:
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class RAGEngine:
    def __init__(self, db_path: str = "data/app.db"):
        self.db_path = db_path
        self.recursive_chunker = RecursiveChunker(chunk_size=400, chunk_overlap=80)
        self.semantic_chunker = StructuralSemanticChunker(target_chunk_size=500)
        self._ensure_table()

    def _ensure_table(self):
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS rag_chunks (
                    id TEXT PRIMARY KEY,
                    doc_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    parent_section TEXT,
                    embedding TEXT NOT NULL,
                    metadata TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def ingest_document(self, doc_id: str, text: str, strategy: str = "semantic") -> List[RAGChunk]:
        """Ingests a document, chunks it, generates embeddings, and saves to database."""
        if strategy == "semantic":
            chunks = self.semantic_chunker.chunk_document(text, doc_id=doc_id)
        else:
            chunks = self.recursive_chunker.chunk_text(text, doc_id=doc_id)

        with sqlite3.connect(self.db_path) as conn:
            for c in chunks:
                emb = compute_deterministic_embedding(c.content)
                c.embedding = emb
                conn.execute(
                    "INSERT OR REPLACE INTO rag_chunks (id, doc_id, content, parent_section, embedding, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                    (c.id, c.doc_id, c.content, c.parent_section or "", json.dumps(emb), json.dumps(c.metadata))
                )
            conn.commit()

        return chunks

    def search(self, query: str, limit: int = 5, min_score: float = 0.1) -> List[Dict[str, Any]]:
        """Hybrid search combining cosine similarity and keyword matching."""
        query_emb = compute_deterministic_embedding(query)
        query_tokens = set(query.lower().split())

        results = []
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, doc_id, content, parent_section, embedding, metadata FROM rag_chunks")
            rows = cursor.fetchall()

            for row in rows:
                c_id, doc_id, content, p_section, emb_json, meta_json = row
                emb = json.loads(emb_json)
                vec_score = cosine_similarity(query_emb, emb)

                # Keyword match boost
                content_tokens = set(content.lower().split())
                keyword_overlap = len(query_tokens.intersection(content_tokens)) / max(len(query_tokens), 1)
                hybrid_score = round((0.7 * vec_score) + (0.3 * keyword_overlap), 4)

                if hybrid_score >= min_score:
                    results.append({
                        "id": c_id,
                        "doc_id": doc_id,
                        "content": content,
                        "parent_section": p_section,
                        "score": hybrid_score,
                        "vector_score": round(vec_score, 4),
                        "keyword_score": round(keyword_overlap, 4),
                        "metadata": json.loads(meta_json) if meta_json else {}
                    })

        results.sort(key=lambda r: r["score"], reverse=True)
        return results[:limit]


if __name__ == "__main__":
    import os
    os.makedirs("data", exist_ok=True)
    engine = RAGEngine()
    sample_doc = """# Archon 2 Multi-Agent Architecture
Archon 2 decomposes complex developer requests into a Directed Acyclic Graph (DAG).
The meta-orchestrator supervises individual agent roles including Architect, Coder, Critic, and Verifier.

## Self-Correction Loop
Every generated artifact goes through a generator -> critic -> refiner loop before being committed.
Deterministic guardrails prevent regression and secret leaks.
"""
    chunks = engine.ingest_document("archon_doc", sample_doc, strategy="semantic")
    print(f"Ingested {len(chunks)} chunks.")
    hits = engine.search("How does self-correction work in Archon 2?")
    print("Search results:")
    for h in hits:
        print(f" - [{h['score']}] {h['parent_section']}: {h['content'][:80]}...")
