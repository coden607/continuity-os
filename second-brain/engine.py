"""
Continuity OS · Second Brain Memory Engine
Implements the 3-Tier Second Brain Memory Stack:
- Tier 1: STATE (mutable current truth, overwrites stale values in MEMORY.md)
- Tier 2: EVENT (append-only timestamped history in daily/YYYY-MM-DD.md)
- Tier 3: Knowledge Base (curated deep references in knowledge-base/)

Features:
- Automated STATE vs EVENT classification
- Contradiction reconciliation (flags claims conflicting with existing memory)
- Memory anti-rot audit (tracks unverified or stale assertions)
"""

import os
import re
import datetime
from typing import Dict, Any, List, Optional, Tuple


class SecondBrainEngine:
    def __init__(self, base_dir: str = "second-brain"):
        self.base_dir = base_dir
        self.memory_path = os.path.join(base_dir, "MEMORY.md")
        self.daily_dir = os.path.join(base_dir, "daily")
        self.kb_dir = os.path.join(base_dir, "knowledge-base")
        os.makedirs(self.daily_dir, exist_ok=True)
        os.makedirs(self.kb_dir, exist_ok=True)

    def classify_fact(self, text: str) -> str:
        """Classifies a new statement as STATE (current truth) or EVENT (timestamped log)."""
        lower = text.lower()
        # Event keywords: dates, past tense verbs, actions performed
        event_markers = ["ran", "tested", "deployed", "fixed", "merged", "yesterday", "today", "at 0", "at 1", "utc", "created commit"]
        # State keywords: current configuration, architecture, rules, owners
        state_markers = ["is ", "always", "rules", "never", "owner", "architecture", "default port", "runtime is"]

        for marker in event_markers:
            if marker in lower:
                return "EVENT"
        for marker in state_markers:
            if marker in lower:
                return "STATE"

        return "STATE" if len(text.split()) < 20 else "EVENT"

    def detect_contradictions(self, new_claim: str) -> List[str]:
        """Checks if a new assertion directly contradicts active memory."""
        contradictions: List[str] = []
        if not os.path.exists(self.memory_path):
            return contradictions

        with open(self.memory_path, "r", encoding="utf-8") as f:
            memory_content = f.read().lower()

        lower_claim = new_claim.lower()
        # Check port contradictions
        claim_port = re.search(r'port\s+(\d+)', lower_claim)
        if claim_port:
            mem_port = re.search(r'port\s+(\d+)', memory_content)
            if mem_port and claim_port.group(1) != mem_port.group(1):
                contradictions.append(f"Port mismatch: new claim states {claim_port.group(1)}, but active memory states {mem_port.group(1)}.")

        # Check database engine contradictions
        if "postgresql" in lower_claim and "sqlite" in memory_content:
            contradictions.append("Database conflict: new claim asserts PostgreSQL, while active memory specifies SQLite.")
        if "sqlite" in lower_claim and "postgresql" in memory_content:
            contradictions.append("Database conflict: new claim asserts SQLite, while active memory specifies PostgreSQL.")

        return contradictions

    def append_event(self, event_text: str) -> str:
        """Appends an EVENT to today's daily log with an ISO timestamp."""
        today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        daily_file = os.path.join(self.daily_dir, f"{today}.md")
        time_str = datetime.datetime.now(datetime.timezone.utc).strftime("%H:%M UTC")

        if not os.path.exists(daily_file):
            with open(daily_file, "w", encoding="utf-8") as f:
                f.write(f"# {today} — Daily Event Log\n\n")

        entry = f"- **{time_str}**: {event_text.strip()}\n"
        with open(daily_file, "a", encoding="utf-8") as f:
            f.write(entry)

        return daily_file

    def audit_memory(self) -> Dict[str, Any]:
        """Performs an anti-rot audit on active memory."""
        if not os.path.exists(self.memory_path):
            return {"status": "missing_memory_file", "issues": 1}

        with open(self.memory_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        unverified_claims = []
        dated_entries = 0

        for line in lines:
            line_str = line.strip()
            if re.search(r'\b20\d{2}-\d{2}-\d{2}\b', line_str):
                dated_entries += 1
            if any(term in line_str.lower() for term in ["maybe", "temporary", "todo", "unconfirmed", "hack"]):
                unverified_claims.append(line_str)

        return {
            "total_lines": len(lines),
            "dated_entries": dated_entries,
            "unverified_claims": unverified_claims,
            "health_score": max(100 - (len(unverified_claims) * 15), 30),
            "status": "healthy" if len(unverified_claims) == 0 else "needs_review"
        }


if __name__ == "__main__":
    engine = SecondBrainEngine()
    print("Classify: 'Node 24 native sqlite is the default engine' ->", engine.classify_fact("Node 24 native sqlite is the default engine"))
    print("Classify: 'Ran npm test and 19 tests passed at 00:54 UTC' ->", engine.classify_fact("Ran npm test and 19 tests passed at 00:54 UTC"))
    conflicts = engine.detect_contradictions("Switch default database to PostgreSQL on port 5432")
    print("Detected contradictions:", conflicts)
    audit = engine.audit_memory()
    print("Memory audit health score:", audit["health_score"], "Status:", audit["status"])
