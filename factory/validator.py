"""
Continuity OS · Holdout Validation Harness & Blast Radius Guard
Implements ADR-002 Phase A and Phase B verification gates:
Phase A: Deterministic Test Suite Run (Binary Pass/Fail)
Phase B: Blast Radius & Negative Invariant Guard:
  1. Test Preservation Invariant: Existing tests must never be deleted or modified
  2. Credential Screening: Diff scanned against secret/key regex patterns
  3. File Footprint Limit: Max modified files ceiling
"""

import os
import sys
import re
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from guardrails.engine import SECRET_PATTERNS


@dataclass
class TestResult:
    passed: bool
    exit_code: int
    duration_ms: int
    output: str


@dataclass
class BlastRadiusResult:
    passed: bool
    violations: List[str]
    files_changed: List[str]
    total_files: int
    insertions: int
    deletions: int


@dataclass
class ValidationVerdict:
    passed: bool
    phase_a: TestResult
    phase_b: BlastRadiusResult
    summary: str


class HoldoutValidator:
    def __init__(self, max_files: int = 10, allow_test_modification: bool = False):
        self.max_files = max_files
        self.allow_test_modification = allow_test_modification

    def run_deterministic_tests(self, worktree_path: Path) -> TestResult:
        """Phase A: Runs the repository test suite inside the worktree."""
        import time
        start_time = time.time()

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

        duration_ms = int((time.time() - start_time) * 1000)
        output = (res.stdout or "") + ("\n" + res.stderr if res.stderr else "")

        return TestResult(
            passed=(res.returncode == 0),
            exit_code=res.returncode,
            duration_ms=duration_ms,
            output=output[-1000:] if len(output) > 1000 else output
        )

    def check_blast_radius(
        self,
        worktree_path: Path,
        base_ref: str = "main"
    ) -> BlastRadiusResult:
        """Phase B: Scans git diff for invariant violations, credential leaks, and scope creep."""
        violations: List[str] = []
        files_changed: List[str] = []
        insertions = 0
        deletions = 0

        # 1. Inspect changed file statuses (M, A, D, R, etc.)
        # Check against base_ref or uncommitted staged/unstaged changes
        name_status_run = subprocess.run(
            ["git", "diff", "--name-status", f"{base_ref}...HEAD"],
            cwd=str(worktree_path),
            capture_output=True,
            text=True,
            check=False
        )

        # Fallback to current working tree diff if branch diff is empty
        diff_text_status = name_status_run.stdout.strip()
        if not diff_text_status:
            name_status_run = subprocess.run(
                ["git", "diff", "--name-status", "HEAD"],
                cwd=str(worktree_path),
                capture_output=True,
                text=True,
                check=False
            )
            diff_text_status = name_status_run.stdout.strip()

        for line in diff_text_status.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split(maxsplit=1)
            if len(parts) == 2:
                status, file_path = parts[0], parts[1]
                files_changed.append(file_path)

                # Test Preservation Invariant:
                # Tests must never be deleted or modified unless explicitly allowed
                is_test_file = (
                    file_path.startswith("tests/") or
                    file_path.startswith("test/") or
                    file_path.endswith(".test.mjs") or
                    file_path.endswith(".test.ts") or
                    file_path.endswith(".test.js") or
                    file_path.endswith("_test.py")
                )

                if is_test_file and not self.allow_test_modification:
                    if status.startswith("D"):
                        violations.append(f"Test Preservation Invariant violated: deleted test file '{file_path}'")
                    elif status.startswith("M"):
                        violations.append(f"Test Preservation Invariant violated: modified existing test file '{file_path}'")

        # 2. File footprint ceiling check
        if len(files_changed) > self.max_files:
            violations.append(f"Blast radius footprint exceeded: {len(files_changed)} files modified (ceiling: {self.max_files})")

        # 3. Credential and Secret Screening across full diff content
        diff_run = subprocess.run(
            ["git", "diff", f"{base_ref}...HEAD"],
            cwd=str(worktree_path),
            capture_output=True,
            text=True,
            check=False
        )
        diff_content = diff_run.stdout
        if not diff_content:
            diff_run = subprocess.run(
                ["git", "diff", "HEAD"],
                cwd=str(worktree_path),
                capture_output=True,
                text=True,
                check=False
            )
            diff_content = diff_run.stdout

        for pattern, label in SECRET_PATTERNS:
            for match in pattern.finditer(diff_content):
                # Only flag added lines (+) to avoid false positives on diff context
                matched_line = diff_content[max(0, match.start() - 50):min(len(diff_content), match.end() + 50)]
                if "+" in matched_line:
                    violations.append(f"Credential Screening violated: detected '{label}' in diff additions")
                    break

        # 4. Count insertions / deletions
        stat_run = subprocess.run(
            ["git", "diff", "--shortstat", f"{base_ref}...HEAD"],
            cwd=str(worktree_path),
            capture_output=True,
            text=True,
            check=False
        )
        stat_out = stat_run.stdout.strip()
        if not stat_out:
            stat_run = subprocess.run(
                ["git", "diff", "--shortstat", "HEAD"],
                cwd=str(worktree_path),
                capture_output=True,
                text=True,
                check=False
            )
            stat_out = stat_run.stdout.strip()

        ins_match = re.search(r'(\d+)\s+insertion', stat_out)
        del_match = re.search(r'(\d+)\s+deletion', stat_out)
        if ins_match:
            insertions = int(ins_match.group(1))
        if del_match:
            deletions = int(del_match.group(1))

        return BlastRadiusResult(
            passed=(len(violations) == 0),
            violations=violations,
            files_changed=files_changed,
            total_files=len(files_changed),
            insertions=insertions,
            deletions=deletions
        )

    def validate_worktree(
        self,
        worktree_path: Path,
        base_ref: str = "main"
    ) -> ValidationVerdict:
        """Executes full Phase A & Phase B verification gate."""
        phase_a = self.run_deterministic_tests(worktree_path)
        phase_b = self.check_blast_radius(worktree_path, base_ref=base_ref)

        overall_passed = phase_a.passed and phase_b.passed
        summary_parts = []
        if not phase_a.passed:
            summary_parts.append(f"Phase A tests failed (exit code {phase_a.exit_code})")
        else:
            summary_parts.append("Phase A tests passed")

        if not phase_b.passed:
            summary_parts.append(f"Phase B blast radius violations: {'; '.join(phase_b.violations)}")
        else:
            summary_parts.append("Phase B blast radius clean")

        return ValidationVerdict(
            passed=overall_passed,
            phase_a=phase_a,
            phase_b=phase_b,
            summary=" | ".join(summary_parts)
        )


if __name__ == "__main__":
    validator = HoldoutValidator()
    print("Testing HoldoutValidator on current repository...")
    verdict = validator.validate_worktree(ROOT_DIR, base_ref="main")
    print(f"Passed: {verdict.passed}")
    print(f"Summary: {verdict.summary}")
    print(f"Phase A exit code: {verdict.phase_a.exit_code}")
    print(f"Phase B files changed: {verdict.phase_b.files_changed}")
