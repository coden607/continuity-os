# Architecture Decision Record (ADR-002)
# Autonomous Multi-Agent Task Runner & Software Factory

- **Status**: Approved
- **Date**: 2026-10-11
- **PRD Reference**: [`factory/prd/PRD-002-AUTONOMOUS-TASK-FACTORY.md`](file:///root/Projects/continuity-os/factory/prd/PRD-002-AUTONOMOUS-TASK-FACTORY.md)
- **Scope**: Engineering Architecture for Dan Shapiro Level 4 Unattended Software Engineering

---

## 1. Executive Summary & Core Decisions

This document establishes the high-level architecture decisions for the **Autonomous Multi-Agent Task Runner & Software Factory** in Continuity OS. 

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FACTORY ARCHITECTURE                            │
├─────────────────────┬──────────────────────────────────────────────────┤
│ Workspace Isolation │ Ephemeral Git Worktrees (`factory/issue-<id>`)   │
├─────────────────────┼──────────────────────────────────────────────────┤
│ Orchestration DAG   │ Archon 2: Architect → Builder → Critic → Verifier│
├─────────────────────┼──────────────────────────────────────────────────┤
│ Model Tier Strategy │ Tiered: Deep (Spec/Critique) + Code (Builder)    │
│                     │       + Deterministic Local Test / Jev (Verifier)│
├─────────────────────┼──────────────────────────────────────────────────┤
│ Validation Gate     │ Native Test Harness + Pre-Commit Invariant Guard │
├─────────────────────┼──────────────────────────────────────────────────┤
│ Persistence         │ SQLite WAL `jobs` + `events` + `records`         │
└─────────────────────┴──────────────────────────────────────────────────┘
```

---

## 2. Decision 1: Execution Isolation via Git Worktrees

### The Options Considered
1. **Option A (Selected): Git Worktree Isolation**  
   Each task creates an isolated git worktree branch at `.worktrees/issue-<id>`. The agent operates exclusively within this worktree, preventing working tree collisions while sharing the host Node/Python runtime and SQLite database.
2. **Option B: Ephemeral Docker Containers**  
   Spinning up containerized microVMs for every task. Maximum isolation, but introduces multi-gigabyte image overhead, Docker-in-Docker complexity, and slow startup latency.
3. **Option C: In-Process Working Directory with Stash**  
   Running directly on the main workspace. Lowest overhead, but dangerous for unattended execution (dirty working tree collisions, risk of uncommitted file loss).

### Rationale
Git worktrees provide instant sub-second setup, full filesystem separation for file edits and test execution, and zero Docker daemon dependency. When a task completes or fails, the worktree is cleanly removed while the branch remains preserved for review.

---

## 3. Decision 2: Tiered Model Dispatch for Archon 2 DAG

To achieve the $>90\%$ token cost compression specified in PRD-002 while maintaining frontier reasoning where it matters:

| Agent Role | Model Tier | Canonical Models | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **Architect** | `deep` (Reasoning) | Claude 3.7 Sonnet / o3-mini / DeepSeek-R1 | Decomposes issue into file contracts and interface specs. |
| **Builder** | `code` (Fast Code) | Claude 3.5 Sonnet / Qwen 2.5 Coder | Implements modular code edits satisfying the architect's contract. |
| **Critic** | `deep` (Reasoning) | Claude 3.7 Sonnet / o3-mini | Adversarial review for security gaps, race conditions, edge cases. |
| **Verifier** | `jev` + Local Host | Local `npm test` + `typesafe/jev-1.13` | Deterministic test execution + sub-100ms policy gate verdict. |

---

## 4. Decision 3: Holdout Validation Harness & Blast Radius Guards

Before any branch is considered for pull request generation, it must clear a **two-phase verification gate**:

### Phase A: Deterministic Test Suite Run
- The factory invokes the target repository's existing test command (`npm test`, `pytest`).
- **Binary Verdict Invariant**:
  - `0 failures`, `0 errors`, `0 regressions` $\longrightarrow$ **PASS**
  - Any failed test or broken assertion $\longrightarrow$ **FAIL** (dispatches builder for self-correction loop, max 2 retries).

### Phase B: Blast Radius & Negative Invariant Guard
The git diff is inspected for prohibited modifications before commit:
1. **Test Preservation Invariant**: New tests may be added, but existing tests must never be deleted or modified unless explicitly requested in the issue spec.
2. **Credential Screening**: Diff is scanned against `guardrails.engine` regex patterns (API keys, private keys, bearer tokens).
3. **File Footprint Limit**: Total modified files must not exceed 10 files without explicit architectural approval.

---

## 5. Decision 4: Data Shape & Lifecycle in SQLite

State is tracked in SQLite WAL via the `jobs` table with explicit lifecycle states:

```
[queued] ──> [triaged] ──> [planning] ──> [building] ──> [critiquing] ──> [validating] ──> [pr_opened] ──> [completed]
     │            │             │              │               │               │
     └────────────┴─────────────┴──────────────┴───────────────┴───────────────┴──> [failed]
```

### Job Record Schema
```typescript
interface FactoryJob {
  id: string;               // e.g. "factory_job_102"
  issue_id: string;         // e.g. "#102"
  title: string;            // Issue title
  status: 'queued' | 'triaged' | 'planning' | 'building' | 'critiquing' | 'validating' | 'pr_opened' | 'completed' | 'failed';
  worktree_path: string;    // e.g. ".worktrees/issue-102"
  branch: string;           // e.g. "factory/issue-102"
  retries_count: number;    // Current retry count (max 2)
  trace: Array<{
    step_id: string;
    role: 'Architect' | 'Builder' | 'Critic' | 'Verifier';
    duration_ms: number;
    tokens_used: number;
    verdict: string;
  }>;
  pr_url?: string;
  created_at: string;
  updated_at: string;
}
```

---

## 6. Boundaries, Secrets & Security Posture

- **Rate Limits & Backoff**: Exponential backoff with jitter on API 429 errors (`base_delay: 2s`, `max_delay: 30s`, `max_retries: 4`).
- **Token Budget Ceilings**: Hard token budget of 50,000 tokens per issue run. If exceeded, the job halts safely and alerts the operator.
- **Human Review Gate (Level 4)**: The factory automatically pushes the branch and creates the PR, but **never auto-merges to main** without human operator approval.

---

## 7. De-Risking Spike: Worktree Cleanliness

- **Spike Objective**: Confirm that creating and tearing down git worktrees concurrently under rapid task succession does not leave stale locks in `.git/worktrees/`.
- **Verdict**: Handled via automated pre-flight worktree prune (`git worktree prune`) on worker initialization.

---

## 8. Upstream Handoff to Epic Slicing (`piv-slice-epic`)

This architecture document is ready to be sliced into discrete PIV loop tickets:
1. **Ticket 1**: Factory Worktree Manager (`factory/worktree.py` — isolated branch setup, teardown, prune).
2. **Ticket 2**: Archon 2 DAG Pipeline Dispatcher (`factory/pipeline.py` — role execution wiring).
3. **Ticket 3**: Holdout Test Harness & Blast Radius Guard (`factory/validator.py` — test runner + diff invariant scanner).
4. **Ticket 4**: PR Payload Synthesizer & Trace Logger (`factory/pr.py` — conventional commit + markdown summary).
5. **Ticket 5**: Stateful Worker Daemon & Triage Cron (`factory/worker.py` — 30-minute polling loop).
