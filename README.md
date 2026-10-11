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

## Universal Fullstack App Engine & PWA
Continuity OS includes a zero-dependency fullstack application template with a mobile-ready PWA shell, native Node 24 SQLite storage, REST endpoints, and automated tests.

- **Frontend:** PWA Shell (`public/index.html`, `public/styles.css`, `public/app.js`, `public/sw.js`)
- **Backend:** Node.js 24 + native `node:sqlite` + TypeScript (`server/server.ts`, `server/db.ts`)
- **Orchestration Bridge:** `POST /api/dispatch` connected to `orchestration/dispatch.py`
- **CLI & Ops:** `python3 manage.py` (status, db-stats, add-record, dispatch, serve, test)
- **Adaptation Guide:** Read [APP_GUIDE.md](file:///root/Projects/continuity-os/APP_GUIDE.md) to convert this into a CRM, AI voice system, SaaS app, or autonomous agent runner.

```bash
# Run tests & typecheck
npm test && npm run typecheck

# Start local server
npm start

# Python management CLI
python3 manage.py status
python3 manage.py dispatch --duty "Your agent task"
```

## Provenance
Distilled from a 21-video Cole Medin sweep (2026-10-05), hardened on a live OpenClaw VPS. MIT. Carry it anywhere — continuity is the point.
