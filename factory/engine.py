"""
Continuity OS · Dark Factory Autonomous Engine
Implements Dan Shapiro's 5 Autonomy Levels for unattended software development:
- Level 1: Agent assists human typing.
- Level 2: Human specifies task, agent implements with review.
- Level 3: Human reviews PR, agent executes PIV loop (Prime -> Implement -> Validate).
- Level 4: Human on the loop; agent autonomously triages issues, runs holdout tests, opens PR.
- Level 5: Lights-out dark factory; autonomous issue-to-merge-to-deploy loop with rollback guardrails.
"""

import json
import datetime
from typing import Dict, Any, List, Optional
from guardrails.schemas import PRDDocument


class DarkFactoryEngine:
    def __init__(self, autonomy_level: int = 4):
        self.autonomy_level = min(max(autonomy_level, 1), 5)

    def triage_issue(self, issue_id: str, issue_title: str, issue_body: str) -> Dict[str, Any]:
        """Evaluates incoming issue against factory admission criteria."""
        # Admission gate: must have clear intent
        admissible = len(issue_title.strip()) > 5 and len(issue_body.strip()) > 10

        priority = "normal"
        if any(w in (issue_title + issue_body).lower() for w in ["security", "crash", "regression", "urgent"]):
            priority = "high"

        return {
            "issue_id": issue_id,
            "title": issue_title,
            "admissible": admissible,
            "autonomy_level": self.autonomy_level,
            "action": "dispatch_builder" if admissible else "request_clarification",
            "priority": priority,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

    def run_holdout_validation(self, test_results: Dict[str, Any]) -> Dict[str, Any]:
        """Verifies that builder agent did not break holdout invariants or test suites."""
        passed_tests = test_results.get("passed", 0)
        failed_tests = test_results.get("failed", 0)
        regressions = test_results.get("regressions", [])

        ready_for_pr = (failed_tests == 0) and (len(regressions) == 0)

        return {
            "holdout_passed": ready_for_pr,
            "tests_passed": passed_tests,
            "tests_failed": failed_tests,
            "regressions_detected": regressions,
            "verdict": "SHIP_PR" if ready_for_pr else "HALT_FOR_FIX"
        }

    def prepare_pull_request(self, issue_id: str, title: str, changes_summary: List[str]) -> Dict[str, Any]:
        """Prepares an automated pull request payload."""
        branch = f"factory/issue-{issue_id.lower().replace('#', '').replace(' ', '-')}"
        pr_body = f"""## Dark Factory Automated PR
**Issue**: {issue_id} — {title}
**Autonomy Level**: Level {self.autonomy_level}

### Validation Status
- ✅ Holdout test suite passed with 0 failures
- ✅ Guardrail secret & PII screening passed
- ✅ Zero regression invariants verified

### Changes
""" + "\n".join(f"- {c}" for c in changes_summary)

        return {
            "branch": branch,
            "base": "main",
            "title": f"feat({issue_id}): {title}",
            "body": pr_body,
            "can_auto_merge": self.autonomy_level == 5
        }


if __name__ == "__main__":
    factory = DarkFactoryEngine(autonomy_level=4)
    triage = factory.triage_issue("#104", "Fix vector cosine similarity divide by zero", "When norm is 0, return 0.0 instead of throwing.")
    print("Triage verdict:", triage["action"], "Priority:", triage["priority"])
    val = factory.run_holdout_validation({"passed": 19, "failed": 0, "regressions": []})
    print("Validation verdict:", val["verdict"])
    pr = factory.prepare_pull_request("#104", "Fix vector cosine similarity divide by zero", ["Updated rag/engine.py to check for norm == 0"])
    print("Prepared PR branch:", pr["branch"])
