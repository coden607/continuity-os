# 🧠 Continuity OS

**Your AI work that survives sessions, machines, and model swaps.** One repo carrying the full agentic stack distilled from Cole Medin's 2026 playbook — routing brain, enforcement hooks, software factory, second brain, isolation, interrupts, token discipline — as portable files, not vaporware. Install it on any CLI that reads `SKILL.md`, any box you touch.

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTINUITY OS                             │
├──────────────┬──────────────────────────────────────────────┤
│ 7 SKILLS     │ behavior layer (auto-loaded by CLIs)         │
├──────────────┼──────────────────────────────────────────────┤
│ hooks/       │ rules enforced at EVENT time                 │
├──────────────┼──────────────────────────────────────────────┤
│ orchestration│ dispatch.py: classify → tier → route (+      │
│              │ 10% judge sampling, outcomes.jsonl learning) │
├──────────────┼──────────────────────────────────────────────┤
│ config/      │ models.yaml — tier→model map, monthly review │
├──────────────┼──────────────────────────────────────────────┤
│ factory/     │ PRD→PR pipeline, autonomy levels, mission log│
├──────────────┼──────────────────────────────────────────────┤
│ second-brain/│ MEMORY + daily events + KB digests           │
└──────────────┴──────────────────────────────────────────────┘
```

## Quickstart (one line)
```bash
curl -fsSL https://raw.githubusercontent.com/coden607/continuity-os/main/scripts/install.sh | bash
```
That gives you: 7 skills in every detected CLI dir + the whole scaffold in `~/continuity-os`, with an install smoke test. Then personalize `config/orchestration/models.yaml` with your model IDs.

## The layers
| Layer | What it enforces | Source skill |
|---|---|---|
| **Route** | Decisions to Jev (~1/1000th LLM cost), duties to cheapest capable tier | `route-with-jev` |
| **Remember** | State vs events split; audits pull contradictions; KB digests beat raw dumps | `maintain-second-brain` |
| **Isolate** | Yolo agents live in the 200–300K dumb zone; destructive ops gated | `isolate-agent-runs` |
| **Build** | Autonomy levels, PRD→PR, factory triage loops | `run-software-factory` |
| **Enforce** | Events > prompts; regex→Jev→LLM judge ladder | `enforce-with-hooks` |
| **Interrupt** | New work adds to or queues behind in-flight work — never silently kills | `route-interrupts` |
| **Spend** | 10% judge sampling, cache-aware prompts, output discipline | `compress-token-spend` |

## Operating rhythm
- **Daily:** events → daily log; flush before any compaction
- **Weekly:** audit MEMORY.md ↔ daily ↔ KB (contradiction pull)
- **Monthly:** models.yaml price review (cron `17 9 1 * *`)
- **Always:** verify on disk, never trust completion events

## Universal Fullstack & Modern Agentic Engine
Continuity OS includes a zero-dependency fullstack application template with a mobile-ready PWA shell, native Node 24 SQLite storage, REST endpoints, automated tests, and the complete modern agentic architecture permanently integrated.

- **🤖 Archon & Archon 2 Multi-Agent Engine:** Directed Acyclic Graph (DAG) task decomposition, dynamic role synthesis (`Architect`, `Builder`, `Critic`, `Verifier`), reflection loops (`Generator -> Critic -> Refiner`), and execution trace logging (`orchestration/archon/`, `/api/archon/plan`, `/api/archon/execute`).
- **🏭 Autonomous Software Factory (Dan Shapiro Levels 1–5):** Unattended software engineering pipeline. Spawns isolated ephemeral git worktrees (`factory/worktree.py`), dispatches Archon 2 DAGs (`factory/pipeline.py`), validates holdout test suites and blast-radius invariant guards (`factory/validator.py`), synthesizes conventional commit and markdown PR payloads (`factory/pr.py`), and executes 30-minute stateful triage cron loops (`factory/worker.py`).
- **🧠 3-Tier Second Brain Memory:** Active mutable truth (`MEMORY.md`), daily immutable event journal (`daily/YYYY-MM-DD.md`), and curated knowledge base. Automated contradiction detection and anti-rot memory health audit (`second-brain/engine.py`, `/api/brain/state`, `/api/brain/audit`).
- **📚 Docling & Paperclip Semantic RAG:** Document parsing preserving markdown headings, recursive character chunker, and structural semantic chunker with breadcrumbs. Cosine vector similarity + BM25 keyword hybrid search (`rag/`, `/api/rag/ingest`, `/api/rag/search`).
- **🛡️ Deterministic Guardrails & Pydantic V2:** Input/output safety screening, prompt injection detection, API key/credential leak prevention, PII redactor, and typed schemas (`guardrails/`, `/api/guardrails/check`).
- **👥 CrewAI, LangGraph & n8n Compatibility:** Native export to CrewAI crews, LangGraph StateGraphs, and bi-directional n8n workflow triggers (`integrations/`, `/api/integrations/crewai`, `/api/webhooks/n8n`).
- **⚖️ Jev System-One Gate (OpenRouter):** Sub-100ms decision gating for `act-gate`, `mode-router`, `retry-stop`, and `legal-risk`. Queries OpenRouter (`OPENROUTER_API_KEY`) for live model inference (`typesafe/jev-1.13`), with deterministic local rubric scoring as an offline fallback (`orchestration/jev_decide.py`, `/api/jev`).
- **💎 Token Spend Optimizer:** Analyzes prompt tokens, pricing across tiers (Frontier vs Standard vs Fast vs Jev), prompt-caching hit structures, and savings percentages (`/api/tokens/analyze`, `orchestration/optimizer.py`).
- **🧠 Canonical Skills (51):** All 51 skills permanently committed in `skills/` and synced to all 5 CLI directories (`~/.claude/skills`, `~/.codex/skills`, `~/.openclaw/skills`, `~/.agents/skills`, and `~/.gemini/antigravity-cli/skills`).
- **⚡ Zero-Dependency Backend:** Node.js 24 + native `node:sqlite` WAL + native TypeScript execution (`server/server.ts`, `server/db.ts`).
- **🛠️ Unified Python CLI:** `python3 manage.py` (`archon`, `rag`, `guardrails`, `brain`, `factory`, `tokens`, `jev`, `prds`, `scaffold`, `serve`, `test`).

```bash
# Run tests (28/28 passing) & typecheck
npm test && npm run typecheck

# Start local server (http://localhost:3000)
npm start

# Python management CLI
python3 manage.py archon "Build automated SQLite migration harness"
python3 manage.py factory worktrees
python3 manage.py factory validate
python3 manage.py factory tick
python3 manage.py brain audit
python3 manage.py guardrails "Test prompt injection sk-1234..."
python3 manage.py jev --state "Perform database migration" --bank act-gate
```

## Provenance
Distilled from a 21-video Cole Medin sweep (2026-10-05), hardened on a live OpenClaw VPS. MIT. Carry it anywhere — continuity is the point.
