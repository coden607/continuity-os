# MEMORY.md — Curated Long-Term State

## Who / What
- **Owner**: coden607 / Stephen
- **Primary Repository**: Continuity OS (`/root/Projects/continuity-os`)
- **Nature**: Universal neutral fullstack operating foundation + Modern Agentic AI Engine (Archon 2, Dark Factory, Second Brain, RAG/Vector/Docling/Paperclip, Pydantic Guardrails, CrewAI/LangChain/n8n, Self-Learning, Jev System-One).
- **Active Skills Palette**: 51 canonical skills deployed permanently in `skills/` and synchronized to all CLI environments (`~/.claude/skills`, `~/.codex/skills`, `~/.openclaw/skills`, `~/.agents/skills`, `~/.gemini/antigravity-cli/skills`).

## Active Architecture
- **Continuity OS Core**: Zero-dependency Node 24 native SQLite WAL API + installable PWA shell + `dispatch.py` routing bridge.
- **Agentic Engine**: Archon 2 multi-agent graph executor, Dan Shapiro Level 4 Autonomous Task Factory (worktree isolation, holdout validation, PR synthesizer, triage daemon), 3-tier Second Brain memory, Docling/Paperclip recursive chunker, hybrid vector search, Pydantic guardrails, and self-learning feedback loops.
- **Multi-Framework Interoperability**: Full export adapters for CrewAI, LangGraph, LangChain (LCEL + 3 StructuredTools), LlamaIndex QueryEngine, and n8n webhooks.
- **Deterministic Enforcement Hooks**: Activated repository-level `.githooks/pre-commit` (credential screening) and `.githooks/pre-push` (automated test gate).
- **Neutral Foundation**: Completely neutral base template with zero hardcoded business apps (Cortese outreach and telephony remain safe in their dedicated repos `/root/Projects/cortese-digital` and `/root/telemarketer-ai`).
- **Jev Decision Layer**: Requires `OPENROUTER_API_KEY` for live sub-100ms model inference via `https://openrouter.ai/api/v1/systemone` (model `typesafe/jev-1.13`); local deterministic rubric acts as offline fallback.

## Architecture Decisions
- **2026-10-11**: Neutralized Continuity OS by decoupling domain-specific busy-call/telephony flows to ensure it serves as the ultimate neutral template capable of becoming any app.
- **2026-10-11**: Integrated full suite of modern agentic stacks: Archon 2, Dark Factory, Second Brain (STATE vs EVENT), Docling/Paperclip semantic chunking + vector search, Pydantic validation, Guardrails, CrewAI/LangGraph/n8n adapters, and Self-Learning loops.
- **2026-10-11**: Loaded all 51 skills into `skills/` permanently.
- **2026-10-11**: Delivered PRD-002 & ADR-002 for Autonomous Task Factory across 5 tickets: WorktreeManager, PipelineDispatcher, HoldoutValidator, PRSynthesizer, and FactoryWorker daemon.
- **2026-10-11**: Merged PR #3 into `main` with 28/28 automated tests passing under Level 4 Human-on-the-Loop review.
- **2026-10-11**: Added LangChain LCEL & Tools + LlamaIndex QueryEngine adapters and activated `.githooks/` for automated test and secret enforcement.

## Provenance & Rules
- Minimal words, direct action, verify on disk.
- Zero-dependency runtime in Node 24 (native sqlite, crypto, test runner, strip-types).
- Never auto-merge to `main` without human review (Level 4 Governance).

## Learned Invariants & Heuristics
- Always guard mathematical operations (norms, divisions, ratios) against zero values before executing. (Learned: 2026-10-11)
- Ensure fresh git worktrees automatically create parent directory for SQLite files before database connections. (Learned: 2026-10-11)
