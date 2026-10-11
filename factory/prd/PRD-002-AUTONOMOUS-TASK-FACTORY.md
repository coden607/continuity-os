# PRD-002: Autonomous Multi-Agent Task Runner & Software Factory

## 1. Problem Statement
Solo technical founders and small engineering teams spend hours daily babysitting AI coding tools line-by-line because current agents hallucinate, lose architectural invariants, and introduce silent regressions when left unattended. 

Developers are forced to either:
1. Sit at the keyboard manually steering every tool call and file edit, or
2. Suffer broken builds, broken database migrations, and wasted review time when letting agents run unmonitored.

As issue backlogs and feature requests accumulate, engineering velocity grinds to a halt not from a lack of coding models, but from a lack of **deterministic validation holdouts and self-correcting agent reflection loops**.

---

## 2. Target Users & JTBD

### Primary User
- **Role**: Solo technical founder, lead engineer, or core developer on small engineering teams.
- **Context**: Maintains an active codebase with existing unit/integration test suites and a backlog of well-scoped bug reports, feature requests, or technical debt tickets.
- **Trigger**: At the end of the workday, or before focusing on high-level architecture, the operator has 3–5 well-defined tickets ready for execution.

### Jobs To Be Done (JTBD)
> **When** well-defined issues or backlog features pile up,  
> **I want to** delegate them to an autonomous factory with holdout test gates and self-correcting multi-agent loops,  
> **So I can** wake up to validated, regression-free pull requests without babysitting the agent line-by-line.

### Explicit Non-Users
- **Non-Technical Vibe Coders**: Users seeking a no-code visual drag-and-drop site builder without technical specifications or automated test harnesses.
- **Open-Ended Exploratory Ideators**: Users who do not know what they want to build and require conversational brainstorming rather than structured software execution.

---

## 3. Falsifiable Hypothesis

> **We believe** that providing developers with an autonomous multi-agent task runner powered by Archon 2 DAG orchestration, Dan Shapiro Level 4 holdout test verification, and Jev system-one decision gating  
> **Will cause** solo technical founders and small dev teams to delegate unattended overnight feature builds and bug fixes,  
> **Resulting in** an 80%+ reduction in manual coding time spent on routine backlog tasks and 90%+ lower token spend compared to un-gated frontier model pairing.

### Leading Signal (We are RIGHT if):
- **$\ge 75\%$ of delegated tasks** produce pull requests that pass all holdout test suites and are merged by the human operator with **under 15 minutes of review** within 14 days of adoption.
- Operators run an average of **$\ge 5$ unattended tasks per developer per week**.

### Counter-Signal (We are WRONG if):
- Operators still intervene mid-run in **$>40\%$ of delegated tasks**, indicating lack of trust in unattended execution; **OR**
- **$>20\%$ of generated pull requests** fail automated holdout validation suites or require substantial manual architectural rewrites; **OR**
- Median token spend per completed ticket exceeds **$15** due to runaway reflection loops.

---

## 4. Minimum Viable Product (MVP) Scope
The thinnest end-to-end slice capable of proving or falsifying the core hypothesis:

1. **Task Ingestion Seam**:
   - Accepts a structured issue (ID, title, requirements, acceptance criteria) via CLI (`python3 manage.py factory`) or REST API (`POST /api/factory/triage`).
2. **Archon 2 Multi-Agent Execution DAG**:
   - Decomposes intent into a Directed Acyclic Graph with 4 synthesized roles:
     - **Architect**: Synthesizes specifications and interface contracts.
     - **Builder**: Implements clean modular code.
     - **Critic**: Adversarially reviews diffs for security, edge cases, and performance regressions.
     - **Verifier**: Runs test harnesses and confirms invariant adherence.
3. **Holdout Validation Harness**:
   - Executes the project's test suite in an isolated environment.
   - Enforces a strict binary verdict: `SHIP_PR` (0 failures, 0 regressions) vs `HALT_FOR_FIX`.
4. **Automated Branch & PR Payload Generation**:
   - Creates an isolated git feature branch (`factory/issue-<id>`).
   - Commits changes with conventional atomic messages.
   - Generates PR summary with validation proof, test counts, and change diff log.
5. **Execution Trace & Audit Logger**:
   - Emits step-by-step trace events (duration, model tier, token accounting, guardrail checks).

---

## 5. Explicit Non-Goals (Out of Scope for MVP)
- **Level 5 Direct-to-Production Auto-Merge**: Strictly capped at Level 4 (human-on-the-loop PR gate). No unattended pushes to `main` without human merge authorization.
- **Complex Multi-Repo Monorepo Syncing**: Single repository workspace only for MVP.
- **Visual Drag-and-Drop Workflow Canvas**: Controlled entirely via CLI, REST API, and native PWA console.
- **Custom Local Fine-Tuning Pipelines**: Uses existing frontier, deep, and fast model tiers via OpenRouter / standard APIs.

---

## 6. Operational Constraints & Boundaries
- **Runtime Footprint**: Zero external database dependencies required; must run on native Node 24 + SQLite WAL mode.
- **Reversibility (Two-Way Door)**: All agent operations execute on isolated feature branches, never mutating the working tree or production branches directly.
- **Deterministic Guardrails**: Secrets, API keys, and private credentials must be masked pre-execution and pre-commit with 100% regex/heuristic coverage.

---

## 7. Success Metrics
- **Primary Metric**: % of opened PRs merged with <15 min human review ($\ge 75\%$).
- **Secondary Metric**: Zero-regression pass rate on holdout test suites ($\ge 98\%$).
- **Efficiency Metric**: Token spend reduction vs un-gated frontier loops ($\ge 90\%$).

---

## 8. Open Questions & Upstream Handoff
- **Handoff to `plan-architecture`**: Specific model provider configurations for the 8 routing tiers, sandbox containerization strategy (Docker vs worktree isolation), and rate-limit backoff policies.
- **Validation Question**: Should holdout test suites include synthetic mutation testing, or rely solely on existing test suites in the target repo? *(TBD — evaluate during initial 14-day user cohort)*.
