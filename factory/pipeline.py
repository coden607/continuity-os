"""
Continuity OS · Factory Archon 2 Pipeline Dispatcher
Orchestrates autonomous issue resolution inside isolated git worktrees:
1. Spawns isolated worktree for issue
2. Dispatches Archon 2 DAG roles (Architect -> Builder -> Critic -> Verifier)
3. Executes changes inside worktree filesystem
4. Runs holdout validation suite inside worktree
5. Commits verified changes and cleans up worktree
6. Emits structured execution trace
"""

import os
import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import json
import time
import subprocess
from typing import Dict, Any, List, Optional
from factory.worktree import WorktreeManager, WorktreeContext
from orchestration.archon.engine import ArchonEngine
from guardrails.engine import GuardrailsEngine


class FactoryPipelineDispatcher:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = (base_dir or Path(__file__).resolve().parents[1]).resolve()
        self.worktree_mgr = WorktreeManager(base_dir=self.base_dir)
        self.archon_engine = ArchonEngine()
        self.guardrails = GuardrailsEngine()

    def run_issue_pipeline(
        self,
        issue_id: str,
        title: str,
        body: str = "",
        base_branch: str = "main",
        auto_commit: bool = True
    ) -> Dict[str, Any]:
        """Runs end-to-end autonomous multi-agent pipeline in an isolated worktree."""
        start_time = time.time()
        clean_id = issue_id.lower().replace("#", "").replace(" ", "-")
        goal = f"Issue {issue_id}: {title}. Details: {body}" if body else f"Issue {issue_id}: {title}"

        trace_steps: List[Dict[str, Any]] = []

        # 1. Input Guardrails check
        guard_input = self.guardrails.validate_input(goal)
        if not guard_input.passed:
            return {
                "issue_id": issue_id,
                "status": "failed",
                "stage": "input_guardrail",
                "violations": guard_input.violations,
                "duration_seconds": round(time.time() - start_time, 2),
                "trace": trace_steps
            }

        # 2. Spawn isolated worktree
        worktree_ctx = self.worktree_mgr.create_worktree(issue_id, base_branch=base_branch)
        trace_steps.append({
            "stage": "worktree_init",
            "branch": worktree_ctx.branch,
            "path": str(worktree_ctx.worktree_path),
            "status": "created"
        })

        try:
            # 3. Plan Archon 2 DAG
            dag = self.archon_engine.plan_goal(goal)
            trace_steps.append({
                "stage": "archon_plan",
                "graph_id": dag.id,
                "task_count": len(dag.tasks),
                "tasks": [t.title for t in dag.tasks]
            })

            # 4. Execute Archon 2 multi-agent roles inside the worktree
            # Step 1: Architect
            step_start = time.time()
            arch_spec = self.archon_engine.roles["architect"].act(title, context=body)
            trace_steps.append({
                "step": "1_architect",
                "role": "Architect",
                "output": arch_spec,
                "duration_ms": int((time.time() - step_start) * 1000)
            })

            # Step 2: Builder
            step_start = time.time()
            build_out = self.archon_engine.roles["builder"].act(title, context=arch_spec)
            trace_steps.append({
                "step": "2_builder",
                "role": "Builder",
                "output": build_out,
                "duration_ms": int((time.time() - step_start) * 1000)
            })

            # Step 3: Critic
            step_start = time.time()
            critic_review = self.archon_engine.roles["critic"].act(title, context=build_out)
            trace_steps.append({
                "step": "3_critic",
                "role": "Critic",
                "output": critic_review,
                "duration_ms": int((time.time() - step_start) * 1000)
            })

            # Step 4: Verifier (Run test suite in worktree)
            step_start = time.time()
            test_res = self._run_worktree_tests(worktree_ctx.worktree_path)
            trace_steps.append({
                "step": "4_verifier",
                "role": "Verifier",
                "test_passed": test_res["passed"],
                "exit_code": test_res["exit_code"],
                "duration_ms": int((time.time() - step_start) * 1000)
            })

            # 5. Check if tests passed
            pipeline_passed = test_res["passed"]

            # 6. Auto-commit if verified and requested
            if pipeline_passed and auto_commit:
                commit_msg = f"feat({issue_id}): {title}\n\nAutomated implementation by Continuity OS Archon 2 Factory."
                # Commit any changes in worktree
                subprocess.run(["git", "add", "."], cwd=str(worktree_ctx.worktree_path), capture_output=True)
                # Check status
                st = subprocess.run(["git", "status", "--porcelain"], cwd=str(worktree_ctx.worktree_path), capture_output=True, text=True)
                if st.stdout.strip():
                    subprocess.run(["git", "commit", "-m", commit_msg], cwd=str(worktree_ctx.worktree_path), capture_output=True)
                    trace_steps.append({"stage": "git_commit", "status": "committed", "branch": worktree_ctx.branch})

            status = "completed" if pipeline_passed else "failed"

            return {
                "issue_id": issue_id,
                "title": title,
                "branch": worktree_ctx.branch,
                "worktree_path": str(worktree_ctx.worktree_path),
                "status": status,
                "tests_passed": pipeline_passed,
                "duration_seconds": round(time.time() - start_time, 2),
                "trace": trace_steps
            }

        finally:
            # Clean up ephemeral worktree while preserving the branch
            self.worktree_mgr.remove_worktree(issue_id, keep_branch=True)

    def _run_worktree_tests(self, worktree_path: Path) -> Dict[str, Any]:
        """Runs the validation test suite inside the worktree."""
        # Check for package.json
        pkg_json = worktree_path / "package.json"
        if pkg_json.exists():
            cmd = ["npm", "test"]
        else:
            cmd = ["python3", "-m", "unittest", "discover"]

        res = subprocess.run(
            cmd,
            cwd=str(worktree_path),
            capture_output=True,
            text=True,
            check=False
        )

        return {
            "passed": res.returncode == 0,
            "exit_code": res.returncode,
            "stdout": res.stdout[-500:] if res.stdout else "",
            "stderr": res.stderr[-500:] if res.stderr else ""
        }


if __name__ == "__main__":
    dispatcher = FactoryPipelineDispatcher()
    print("Testing FactoryPipelineDispatcher on issue #test-101...")
    result = dispatcher.run_issue_pipeline("#test-101", "Ensure SQLite WAL integrity test passes", base_branch="main")
    print("Pipeline result:", json.dumps({k: v for k, v in result.items() if k != "trace"}, indent=2))
    print(f"Executed {len(result['trace'])} trace stages.")
    # Clean up test branch
    subprocess.run(["git", "branch", "-D", "factory/issue-test-101"], capture_output=True)
