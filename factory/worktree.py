"""
Continuity OS · Factory Git Worktree Manager
Manages ephemeral isolated git worktrees for unattended multi-agent task execution:
- Spawns worktree on isolated branch `factory/issue-<id>`
- Prunes stale worktree locks
- Injects environment configs into isolated directory
- Cleans up worktree on completion while preserving the branch for PR generation
"""

import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from dataclasses import dataclass


@dataclass
class WorktreeContext:
    issue_id: str
    branch: str
    worktree_path: Path
    base_dir: Path


class WorktreeManager:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = (base_dir or Path(__file__).resolve().parents[1]).resolve()
        self.worktrees_root = self.base_dir / ".worktrees"

    def _run_git(self, args: List[str], cwd: Optional[Path] = None) -> subprocess.CompletedProcess:
        target_cwd = cwd or self.base_dir
        cmd = ["git"] + args
        return subprocess.run(
            cmd,
            cwd=str(target_cwd),
            capture_output=True,
            text=True,
            check=False
        )

    def prune(self) -> None:
        """Prunes stale worktree registrations."""
        self._run_git(["worktree", "prune"])

    def create_worktree(self, issue_id: str, base_branch: str = "main") -> WorktreeContext:
        """Creates an isolated git worktree branch for a task."""
        clean_id = issue_id.lower().replace("#", "").replace(" ", "-")
        branch_name = f"factory/issue-{clean_id}"
        worktree_path = (self.worktrees_root / f"issue-{clean_id}").resolve()

        self.prune()
        self.worktrees_root.mkdir(parents=True, exist_ok=True)

        # Check if worktree directory already exists
        if worktree_path.exists():
            self.remove_worktree(issue_id, keep_branch=True)

        # Check if branch exists
        branch_check = self._run_git(["show-ref", "--verify", f"refs/heads/{branch_name}"])
        branch_exists = branch_check.returncode == 0

        if branch_exists:
            # Attach to existing branch
            res = self._run_git(["worktree", "add", str(worktree_path), branch_name])
        else:
            # Create new branch from base_branch
            res = self._run_git(["worktree", "add", "-b", branch_name, str(worktree_path), base_branch])

        if res.returncode != 0:
            raise RuntimeError(f"Failed to create git worktree: {res.stderr.strip() or res.stdout.strip()}")

        # Copy .env if present in root
        root_env = self.base_dir / ".env"
        if root_env.exists():
            shutil.copy(root_env, worktree_path / ".env")

        # Ensure essential directories like data/ exist in worktree
        (worktree_path / "data").mkdir(parents=True, exist_ok=True)

        # Symlink node_modules if present in root to avoid re-installing
        root_nm = self.base_dir / "node_modules"
        target_nm = worktree_path / "node_modules"
        if root_nm.exists() and not target_nm.exists():
            try:
                os.symlink(root_nm, target_nm)
            except OSError:
                pass

        return WorktreeContext(
            issue_id=issue_id,
            branch=branch_name,
            worktree_path=worktree_path,
            base_dir=self.base_dir
        )

    def remove_worktree(self, issue_id: str, keep_branch: bool = True) -> bool:
        """Removes an active worktree while optionally keeping the feature branch."""
        clean_id = issue_id.lower().replace("#", "").replace(" ", "-")
        worktree_path = (self.worktrees_root / f"issue-{clean_id}").resolve()

        if not worktree_path.exists():
            self.prune()
            return True

        res = self._run_git(["worktree", "remove", "--force", str(worktree_path)])
        self.prune()

        # If directory still exists on disk, safely clean it
        if worktree_path.exists():
            shutil.rmtree(worktree_path, ignore_errors=True)

        return res.returncode == 0

    def list_worktrees(self) -> List[Dict[str, str]]:
        """Lists active git worktrees."""
        res = self._run_git(["worktree", "list", "--porcelain"])
        if res.returncode != 0:
            return []

        worktrees = []
        current: Dict[str, str] = {}
        for line in res.stdout.splitlines():
            line = line.strip()
            if not line:
                if current:
                    worktrees.append(current)
                    current = {}
                continue
            if line.startswith("worktree "):
                current["path"] = line.split(" ", 1)[1]
            elif line.startswith("branch "):
                current["branch"] = line.split(" ", 1)[1]
            elif line == "bare":
                current["bare"] = "true"

        if current:
            worktrees.append(current)

        return worktrees


if __name__ == "__main__":
    mgr = WorktreeManager()
    print("Listing initial worktrees:", len(mgr.list_worktrees()))
    ctx = mgr.create_worktree("test-99", base_branch="main")
    print(f"Created worktree at: {ctx.worktree_path} on branch {ctx.branch}")
    print("Active worktrees after creation:", len(mgr.list_worktrees()))
    mgr.remove_worktree("test-99", keep_branch=True)
    print("Active worktrees after removal:", len(mgr.list_worktrees()))
