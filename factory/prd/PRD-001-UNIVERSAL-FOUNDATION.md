# PRD-001: Continuity OS Universal Agentic Operating Foundation

## 1. Problem Definition
Modern AI coding and autonomous agents suffer from fragmented stacks, high runtime token costs, lack of deterministic guardrails, brittle multi-agent coordination, and memory rot. Developers repeatedly reinvent vector search, PRD pipelines, and multi-agent loops across different tools.

## 2. Hypothesis & Approach
By combining a zero-dependency fullstack runtime (Node 24 + SQLite WAL) with a complete agentic stack (Archon 2 DAG execution, Dan Shapiro Level 1-5 Dark Factory, 3-tier Second Brain memory, Docling/Paperclip semantic chunking, Pydantic guardrails, and Jev system-one gating), developers get an unopinionated, neutral operating system that can transform into any target application.

## 3. Autonomy Levels
- **Level 1-3**: Interactive pairing with PIV loops.
- **Level 4**: Autonomous triage and holdout regression testing.
- **Level 5**: Lights-out continuous software factory.

## 4. MVP Scope
- Zero-dependency Node 24 native SQLite engine (`server/server.ts`, `server/db.ts`).
- Archon 2 multi-agent DAG engine (`orchestration/archon/`).
- Dan Shapiro Dark Factory autonomous triage/build runner (`factory/engine.py`).
- 3-tier Second Brain memory with contradiction reconciliation (`second-brain/engine.py`).
- Docling & Paperclip semantic chunking with hybrid vector retrieval (`rag/`).
- Deterministic guardrails & Pydantic V2 typed validation (`guardrails/`).
- Interoperability with CrewAI, LangGraph, and n8n webhooks (`integrations/`).
- Jev system-one decision gateway with OpenRouter live inference and local fallback (`orchestration/jev_decide.py`).

## 5. Non-Goals
- Hardcoding domain-specific business flows (e.g. restaurant missed calls).
- Locking into a single closed AI provider.

## 6. Success Metrics
- 100% test pass rate across all unit and integration suites.
- Sub-50ms local endpoint latency.
- Zero external runtime npm dependencies.
