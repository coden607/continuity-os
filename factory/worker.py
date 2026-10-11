"""
Continuity OS · Stateful Worker Daemon & Triage Cron
Implements ADR-002 Dan Shapiro Level 4 Unattended Software Engineering:
- 30-minute stateful polling loop / cron triage
- Issue ingestion from GitHub CLI (gh) or internal SQLite queue
- Worktree isolation, Archon 2 DAG dispatch, Holdout Validation
- Pull Request synthesis and push without auto-merging to main
- SQLite WAL state machine persistence (jobs + events)
"""

import os
import sys
import json
import time
import sqlite3
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from factory.worktree import WorktreeManager
from factory.pipeline import FactoryPipelineDispatcher
from factory.validator import HoldoutValidator, ValidationVerdict
from factory.pr import PRSynthesizer


class FactoryWorker:
    def __init__(self, db_path: Optional[str] = None, autonomy_level: int = 4):
        self.base_dir = ROOT_DIR
        self.db_path = db_path or str(self.base_dir / "data" / "app.db")
        self.autonomy_level = autonomy_level
        self.worktree_mgr = WorktreeManager(base_dir=self.base_dir)
        self.pipeline = FactoryPipelineDispatcher(base_dir=self.base_dir)
        self.validator = HoldoutValidator(allow_test_modification=True)
        self.pr_synthesizer = PRSynthesizer(autonomy_level=autonomy_level)
        self._ensure_db()

    def _ensure_db(self) -> None:
        """Ensures SQLite jobs and events tables exist."""
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    queue TEXT NOT NULL DEFAULT 'default',
                    payload TEXT NOT NULL DEFAULT '{}',
                    status TEXT NOT NULL DEFAULT 'pending',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    max_attempts INTEGER NOT NULL DEFAULT 3,
                    run_at TEXT NOT NULL,
                    locked_at TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL,
                    payload TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                )
            """)

    def _log_event(self, event_type: str, payload: Dict[str, Any]) -> None:
        """Logs event to SQLite events table."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT INTO events (type, payload, created_at) VALUES (?, ?, ?)",
                    (event_type, json.dumps(payload), time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
                )
        except Exception:
            pass

    def enqueue_task(
        self,
        issue_id: str,
        title: str,
        body: str = "",
        base_branch: str = "main"
    ) -> str:
        """Enqueues a new factory task into the SQLite queue."""
        clean_id = issue_id.replace("#", "").strip()
        job_id = f"factory_job_{clean_id}_{int(time.time())}"
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        payload = {
            "issue_id": issue_id,
            "title": title,
            "body": body,
            "base_branch": base_branch,
            "autonomy_level": self.autonomy_level
        }

        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO jobs (id, queue, payload, status, attempts, max_attempts, run_at, created_at, updated_at)
                VALUES (?, 'factory', ?, 'pending', 0, 3, ?, ?, ?)
            """, (job_id, json.dumps(payload), now_iso, now_iso, now_iso))

        self._log_event("factory.task_enqueued", {"job_id": job_id, "issue_id": issue_id, "title": title})
        return job_id

    def fetch_github_issues(self) -> List[Dict[str, Any]]:
        """Queries GitHub CLI for open issues to process."""
        cmd = ["gh", "issue", "list", "--json", "number,title,body,labels,state", "--limit", "10"]
        res = subprocess.run(cmd, cwd=str(self.base_dir), capture_output=True, text=True, check=False)
        if res.returncode != 0:
            return []

        try:
            issues = json.loads(res.stdout)
            enqueued = []
            for iss in issues:
                issue_id = f"#{iss.get('number')}"
                title = iss.get("title", "")
                body = iss.get("body", "")

                # Check if already processed or pending in jobs table
                with sqlite3.connect(self.db_path) as conn:
                    cur = conn.execute(
                        "SELECT id FROM jobs WHERE queue = 'factory' AND payload LIKE ?",
                        (f'%"{issue_id}"%',)
                    )
                    existing = cur.fetchone()

                if not existing:
                    job_id = self.enqueue_task(issue_id, title, body)
                    enqueued.append({"job_id": job_id, "issue_id": issue_id, "title": title})

            return enqueued
        except Exception:
            return []

    def claim_next_job(self) -> Optional[Dict[str, Any]]:
        """Atomically claims the next pending factory job."""
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute("""
                SELECT * FROM jobs
                WHERE queue = 'factory' AND status = 'pending' AND run_at <= ?
                ORDER BY created_at ASC LIMIT 1
            """, (now_iso,))
            row = cur.fetchone()
            if not row:
                return None

            job_dict = dict(row)
            conn.execute("""
                UPDATE jobs
                SET status = 'running', locked_at = ?, attempts = attempts + 1, updated_at = ?
                WHERE id = ?
            """, (now_iso, now_iso, job_dict["id"]))
            return job_dict

    def process_next_job(self) -> Optional[Dict[str, Any]]:
        """Executes full unattended resolution lifecycle on next pending job."""
        job = self.claim_next_job()
        if not job:
            return None

        job_id = job["id"]
        payload = json.loads(job["payload"])
        issue_id = payload.get("issue_id", "#1")
        title = payload.get("title", "")
        body = payload.get("body", "")
        base_branch = payload.get("base_branch", "main")

        self._log_event("factory.job_started", {"job_id": job_id, "issue_id": issue_id, "title": title})

        try:
            # 1. Run Archon 2 pipeline in isolated worktree
            pipeline_result = self.pipeline.run_issue_pipeline(
                issue_id=issue_id,
                title=title,
                body=body,
                base_branch=base_branch,
                auto_commit=True
            )

            branch = pipeline_result.get("branch")
            tests_passed = pipeline_result.get("tests_passed", False)
            trace = pipeline_result.get("trace", [])

            # Extract role outputs from trace
            architect_spec = ""
            builder_changes = ""
            critic_review = ""
            for step in trace:
                if step.get("role") == "Architect":
                    architect_spec = step.get("output", "")
                elif step.get("role") == "Builder":
                    builder_changes = step.get("output", "")
                elif step.get("role") == "Critic":
                    critic_review = step.get("output", "")

            # 2. Synthesize PR description
            pr_body = self.pr_synthesizer.generate_pr_body(
                issue_id=issue_id,
                title=title,
                architect_spec=architect_spec,
                builder_changes=builder_changes,
                critic_review=critic_review,
                trace=trace
            )

            pr_status = "not_dispatched"
            pr_url = None

            # 3. Push branch and create PR (Level 4: Human-on-the-Loop)
            if tests_passed and branch:
                # Push branch to origin
                subprocess.run(
                    ["git", "push", "-u", "origin", branch],
                    cwd=str(self.base_dir),
                    capture_output=True,
                    check=False
                )
                # Dispatch PR via gh CLI
                disp_res = self.pr_synthesizer.dispatch_pr(
                    cwd=self.base_dir,
                    branch=branch,
                    base_branch=base_branch,
                    title=f"feat({issue_id.replace('#', '')}): {title}",
                    body=pr_body
                )
                if disp_res.get("success"):
                    pr_status = "pr_opened"
                    pr_url = disp_res.get("pr_url")

            # 4. Update SQLite state
            final_status = "completed" if tests_passed else "failed"
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE jobs
                    SET status = ?, locked_at = NULL, updated_at = ?
                    WHERE id = ?
                """, (final_status, now_iso, job_id))

            result_summary = {
                "job_id": job_id,
                "issue_id": issue_id,
                "title": title,
                "branch": branch,
                "tests_passed": tests_passed,
                "pr_status": pr_status,
                "pr_url": pr_url,
                "status": final_status
            }

            self._log_event("factory.job_completed", result_summary)
            return result_summary

        except Exception as e:
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE jobs
                    SET status = 'failed', error = ?, locked_at = NULL, updated_at = ?
                    WHERE id = ?
                """, (str(e), now_iso, job_id))

            self._log_event("factory.job_failed", {"job_id": job_id, "error": str(e)})
            return {"job_id": job_id, "status": "failed", "error": str(e)}

    def run_triage_loop(
        self,
        poll_interval_seconds: int = 1800,
        max_iterations: Optional[int] = None
    ) -> None:
        """Runs the 30-minute stateful triage cron loop."""
        iteration = 0
        while True:
            iteration += 1
            # 1. Fetch remote issues from GitHub if available
            self.fetch_github_issues()

            # 2. Process all pending jobs in the queue
            while True:
                processed = self.process_next_job()
                if not processed:
                    break

            if max_iterations and iteration >= max_iterations:
                break

            time.sleep(poll_interval_seconds)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Continuity OS Factory Worker")
    parser.add_argument("--enqueue", action="store_true", help="Enqueue task")
    parser.add_argument("--issue-id", default="#test-99", help="Issue ID")
    parser.add_argument("--title", default="Factory Verification Test", help="Task title")
    parser.add_argument("--body", default="Run factory worker automated flow", help="Task body")
    parser.add_argument("--once", action="store_true", help="Process single pending job")
    parser.add_argument("--daemon", action="store_true", help="Run 30-minute cron daemon")

    args = parser.parse_args()
    worker = FactoryWorker()

    if args.enqueue:
        job_id = worker.enqueue_task(args.issue_id, args.title, args.body)
        print(f"Task enqueued: {job_id}")

    elif args.once:
        res = worker.process_next_job()
        print("Processed job result:", json.dumps(res, indent=2))

    elif args.daemon:
        print("Starting 30-minute stateful triage daemon (Level 4)...")
        worker.run_triage_loop(poll_interval_seconds=1800)

    else:
        print("Testing FactoryWorker queue and process cycle...")
        job_id = worker.enqueue_task("#test-worker", "Verify Worker State Machine", "Test description")
        res = worker.process_next_job()
        print("Process result:", json.dumps(res, indent=2))
        # Prune test branch
        subprocess.run(["git", "branch", "-D", "factory/issue-test-worker"], capture_output=True)
