"""
Continuity OS · Pydantic V2 Schemas
Canonical typed data models for multi-agent tasks, execution traces,
RAG chunks, guardrail results, and Jev decisions.
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field
import datetime


class AgentTask(BaseModel):
    id: str = Field(..., description="Unique task identifier")
    title: str = Field(..., description="Human-readable task title")
    description: str = Field("", description="Detailed task requirements")
    tier: Literal["frontier", "deep", "code", "general", "simple", "bulk", "jev", "regex"] = Field(
        "general", description="Target model tier"
    )
    dependencies: List[str] = Field(default_factory=list, description="IDs of prerequisite tasks")
    max_tokens: int = Field(2000, description="Token spend ceiling")
    timeout_seconds: int = Field(300, description="Maximum execution duration")
    status: Literal["pending", "running", "completed", "failed", "blocked"] = "pending"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentStep(BaseModel):
    step_id: str
    role: str
    action: str
    input_text: str
    output_text: str
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    tokens_used: int = 0
    duration_ms: int = 0
    timestamp: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class GuardrailResult(BaseModel):
    passed: bool
    risk_score: float = Field(0.0, ge=0.0, le=1.0)
    violations: List[str] = Field(default_factory=list)
    sanitized_text: str
    checks_performed: List[str] = Field(default_factory=list)


class RAGChunk(BaseModel):
    id: str
    doc_id: str
    content: str
    chunk_index: int
    char_count: int
    parent_section: Optional[str] = None
    embedding: Optional[List[float]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PRDDocument(BaseModel):
    id: str
    title: str
    problem: str
    evidence: str
    hypothesis: str
    mvp_scope: List[str]
    non_goals: List[str]
    success_metrics: List[str]
    autonomy_level: int = Field(3, ge=1, le=5)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class JevDecision(BaseModel):
    bank: str
    state: str
    choice: str
    confidence: float = Field(0.9, ge=0.0, le=1.0)
    mode: Literal["openrouter-live", "offline-fallback"] = "offline-fallback"
    explanation: str = ""
