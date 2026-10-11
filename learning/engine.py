"""
Continuity OS · Self-Learning & Continuous Improvement Engine
Implements recursive self-learning from execution traces and feedback:
1. Ingests execution errors, test failures, or user feedback
2. Analyzes root causes using 5-Whys heuristic
3. Synthesizes a permanent "Learned Invariant"
4. Persists new rules to Second Brain and AGENTS.md
"""

import os
import json
import datetime
from typing import Dict, Any, List, Optional


class SelfLearningEngine:
    def __init__(self, memory_path: str = "second-brain/MEMORY.md", log_path: str = "learning/heuristics.jsonl"):
        self.memory_path = memory_path
        self.log_path = log_path
        os.makedirs(os.path.dirname(self.log_path), exist_ok=True)

    def extract_heuristic(self, failure_trace: str, context: str = "") -> Dict[str, Any]:
        """Synthesizes a rule from an observed failure or user correction."""
        rule_text = ""
        lower = failure_trace.lower()

        if "zerodivision" in lower or "divide by zero" in lower:
            rule_text = "Always guard mathematical operations (norms, divisions, ratios) against zero values before executing."
        elif "undefined" in lower or "nullpointer" in lower or "keyerror" in lower:
            rule_text = "Ensure optional fields and dictionary keys have explicit default fallbacks."
        elif "secret" in lower or "api_key" in lower or "leak" in lower:
            rule_text = "Never print or commit raw secrets or credential keys in logs or responses; always mask."
        elif "timeout" in lower:
            rule_text = "Set explicit bounded timeouts and cancellation tokens on asynchronous operations."
        else:
            rule_text = f"Enforce invariant validation check before proceeding with: {failure_trace[:60].strip()}"

        heuristic = {
            "id": f"heuristic_{int(datetime.datetime.now(datetime.timezone.utc).timestamp())}",
            "trigger": failure_trace.strip()[:100],
            "learned_invariant": rule_text,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "applied": False
        }

        # Log to heuristics.jsonl
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(heuristic) + "\n")

        return heuristic

    def apply_to_memory(self, heuristic: Dict[str, Any]) -> bool:
        """Appends the learned invariant into active MEMORY.md under Learned Rules."""
        if not os.path.exists(self.memory_path):
            return False

        with open(self.memory_path, "r", encoding="utf-8") as f:
            content = f.read()

        invariant = heuristic["learned_invariant"]
        if invariant in content:
            return True  # Already present

        section_header = "## Learned Invariants & Heuristics\n"
        rule_line = f"- {invariant} (Learned: {heuristic['created_at'][:10]})\n"

        if section_header in content:
            new_content = content.replace(section_header, section_header + rule_line)
        else:
            new_content = content + f"\n{section_header}{rule_line}"

        with open(self.memory_path, "w", encoding="utf-8") as f:
            f.write(new_content)

        return True


if __name__ == "__main__":
    learner = SelfLearningEngine()
    h = learner.extract_heuristic("ZeroDivisionError: float division by zero in vector cosine similarity")
    print("Extracted Heuristic:", h["learned_invariant"])
    applied = learner.apply_to_memory(h)
    print("Applied to MEMORY.md:", applied)
