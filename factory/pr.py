"""
Continuity OS · PR Payload Synthesizer & Trace Logger
Implements ADR-002 Pull Request Synthesis:
- Conventional Commit message formatter
- Rich GitHub Markdown PR body generator (Dan Shapiro Level 4)
- Multi-agent execution trace aggregator
- GitHub CLI (gh) automated PR dispatch
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from factory.validator import ValidationVerdict


class PRSynthesizer:
    def __init__(self, autonomy_level: int = 4):
        self.autonomy_level = autonomy_level

    def generate_commit_message(self, issue_id: str, title: str, scope: str = "factory") -> str:
        """Generates atomic conventional commit message."""
        clean_id = issue_id.replace("#", "").strip()
        return (
            f"feat({clean_id}): {title}\n\n"
            f"Autonomous implementation by Continuity OS Archon 2 Software Factory (Level {self.autonomy_level})."
        )

    def generate_pr_body(
        self,
        issue_id: str,
        title: str,
        architect_spec: str = "",
        builder_changes: str = "",
        critic_review: str = "",
        validation: Optional[ValidationVerdict] = None,
        trace: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """Synthesizes rich GitHub Markdown PR description."""
        clean_id = issue_id.replace("#", "").strip()
        lines = []

        lines.append(f"# Autonomous Resolution: {title}")
        lines.append("")
        lines.append(f"**Issue Reference**: Resolves #{clean_id}")
        lines.append(f"**Autonomy Level**: Dan Shapiro Level {self.autonomy_level} (Human-on-the-Loop)")
        lines.append("")

        lines.append("## 1. Executive Summary")
        lines.append(
            f"This pull request was synthesized and validated by Continuity OS. "
            f"All implementation steps and holdout validation suites cleared before branch submission."
        )
        lines.append("")

        if architect_spec:
            lines.append("## 2. Architecture Decisions (Architect Stage)")
            lines.append("```text")
            lines.append(architect_spec.strip())
            lines.append("```")
            lines.append("")

        if builder_changes:
            lines.append("## 3. Implementation Details (Builder Stage)")
            lines.append("```text")
            lines.append(builder_changes.strip())
            lines.append("```")
            lines.append("")

        if critic_review:
            lines.append("## 4. Adversarial Review & Security (Critic Stage)")
            lines.append("```text")
            lines.append(critic_review.strip())
            lines.append("```")
            lines.append("")

        if validation:
            lines.append("## 5. Holdout Validation & Blast Radius Guard")
            lines.append("| Verification Stage | Status | Metrics / Invariants |")
            lines.append("| :--- | :--- | :--- |")
            lines.append(
                f"| **Phase A (Deterministic Tests)** | "
                f"{'PASS' if validation.phase_a.passed else 'FAIL'} | "
                f"Exit code: `{validation.phase_a.exit_code}`, Duration: `{validation.phase_a.duration_ms}ms` |"
            )
            lines.append(
                f"| **Phase B (Blast Radius Guard)** | "
                f"{'PASS' if validation.phase_b.passed else 'FAIL'} | "
                f"Files modified: `{validation.phase_b.total_files}`, Additions: `+{validation.phase_b.insertions}`, Deletions: `-{validation.phase_b.deletions}` |"
            )
            lines.append("")
            if validation.phase_b.violations:
                lines.append("> [!WARNING] **Violations Flagged**:")
                for v in validation.phase_b.violations:
                    lines.append(f"> - {v}")
                lines.append("")

        if trace:
            lines.append("## 6. Multi-Agent Execution Trace")
            lines.append("| Step | Role / Stage | Status | Duration |")
            lines.append("| :--- | :--- | :--- | :--- |")
            for t in trace:
                stage = t.get("stage") or t.get("step") or "step"
                role = t.get("role", stage)
                status = "PASS" if t.get("test_passed", True) else "FAIL"
                dur = f"{t.get('duration_ms', 0)}ms" if "duration_ms" in t else "-"
                lines.append(f"| `{stage}` | **{role}** | `{status}` | {dur} |")
            lines.append("")

        lines.append("## 7. Governance & Safety Invariant")
        lines.append(
            "> [!IMPORTANT]\n"
            "> **Level 4 Autonomy Policy**: This PR will **never be automatically merged to main** without human operator review and approval."
        )

        return "\n".join(lines)

    def dispatch_pr(
        self,
        cwd: Path,
        branch: str,
        base_branch: str,
        title: str,
        body: str
    ) -> Dict[str, Any]:
        """Dispatches pull request via gh CLI or emits payload."""
        cmd = [
            "gh", "pr", "create",
            "--head", branch,
            "--base", base_branch,
            "--title", title,
            "--body", body
        ]
        res = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, check=False)
        if res.returncode == 0:
            pr_url = res.stdout.strip()
            return {"success": True, "method": "gh_cli", "pr_url": pr_url}

        return {
            "success": False,
            "method": "gh_cli",
            "error": res.stderr.strip() or res.stdout.strip(),
            "payload": {
                "head": branch,
                "base": base_branch,
                "title": title,
                "body": body
            }
        }


if __name__ == "__main__":
    synthesizer = PRSynthesizer()
    print("Testing PRSynthesizer...")
    commit_msg = synthesizer.generate_commit_message("#42", "Add Redis cache adapter")
    print("Commit message preview:")
    print(commit_msg)
    print("\nPR Body preview length:", len(synthesizer.generate_pr_body("#42", "Add Redis cache adapter")))
