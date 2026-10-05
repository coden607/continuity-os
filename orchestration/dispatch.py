#!/usr/bin/env python3
"""Classify a duty into a routing plan (model tier, chunking, memory queries, kit).

Heuristic by default. With OPENROUTER_API_KEY present, asks Jev for a typed
route choice + complexity score and merges it in (Jev wins on conflicts).
"""
import argparse
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tok import estimate_tokens  # noqa: E402

# outcomes.jsonl ships next to dispatch.py in the repo AND in installs
# (installer creates it there; status.sh counts that copy). models.yaml's
# feedback.log ("orchestration/outcomes.jsonl") is relative to this same root.
OUTCOMES_LOG = os.path.join(HERE, "outcomes.jsonl")

# jev_decide.py ships NEXT to dispatch.py in the OS (orchestration/ or a skill's
# scripts/ dir). Fall back to the youtube-learn skill copy if not alongside.
_local = os.path.join(HERE, "jev_decide.py")
JEV = (_local if os.path.exists(_local)
       else os.path.expanduser("~/.openclaw/skills/youtube-learn/scripts/jev_decide.py"))

TIERS = {
    "chitchat":  {"route": "inline-cheap",  "model": "small/fast", "chunking": False},
    "simple":    {"route": "inline-cheap",  "model": "small/fast", "chunking": False},
    "reasoning": {"route": "inline-strong", "model": "frontier",   "chunking": False},
    "code":      {"route": "subagent",      "model": "code-strong","chunking": False},
    "creative":  {"route": "inline-strong", "model": "frontier",   "chunking": False},
    "research":  {"route": "subagent",      "model": "frontier",   "chunking": True},
    "long-doc":  {"route": "chunked",       "model": "frontier",   "chunking": True},
}
KW = [
    ("chitchat", r"\b(hi|hello|thanks|lol|yo)\b"),
    ("code", r"\b(code|function|bug|refactor|script|python|api)\b"),
    ("long-doc", r"\b(transcrib|document|paper|pdf|corpus|entire)\b"),
    ("research", r"\b(research|investigate|compare|find out|analyze)\b"),
    ("creative", r"\b(write|draft|story|poem|name|brainstorm)\b"),
    ("reasoning", r"\b(plan|design|architect|decide|strategy|why)\b"),
    ("simple", r"\b(check|fix|rename|convert|translate)\b"),
]
PERSONA_HINTS = {
    "code": "You are a senior engineer. Be precise, show working code, cite file:line.",
    "research": "You are a meticulous researcher. Verify claims, cite sources, flag uncertainty.",
    "creative": "You are a sharp creative partner. Give 3 options, commit to the best one.",
    "reasoning": "You are a systems thinker. Structure the analysis, then decide.",
    "long-doc": "You are a document analyst. Process each chunk, keep a running synthesis.",
    "simple": "You are a fast operator. Do exactly what was asked, nothing more.",
    "chitchat": "You are a friendly assistant. Keep it short and warm.",
}


def heuristic(duty: str):
    d = duty.lower()
    for tier, pat in KW:
        m = re.search(pat, d)
        if m:
            return tier, f"keyword '{m.group(0)}' matched tier '{tier}'"
    return "simple", "no keyword matched; default tier 'simple'"


def ask_jev(duty: str):
    if not os.environ.get("OPENROUTER_API_KEY") and not os.path.exists(
            os.path.expanduser("~/.openclaw/workspace/.jev_key")):
        return None
    qs = {
        "route": {"type": "choice", "instructions": "Best execution route for this duty?",
                  "criteria": {k: v["route"] + "/" + v["model"] for k, v in TIERS.items()}},
        "complexity": {"type": "score", "instructions": "How cognitively heavy is this duty?",
                       "criteria": ["trivial", "easy", "moderate", "hard", "frontier-only"]},
    }
    p = subprocess.run([sys.executable, os.path.abspath(JEV), "--state", duty,
                        "--questions", json.dumps(qs)],
                       capture_output=True, text=True, timeout=90)
    if p.returncode != 0:
        return {"jev_error": p.stderr.strip()[:200]}
    resp = json.loads(p.stdout)
    return resp.get("answers", {})


def build_plan(duty: str, with_jev: bool) -> dict:
    tier, why = heuristic(duty)
    jev = ask_jev(duty) if with_jev else None
    if jev and "route" in jev:
        probs = jev["route"].get("probabilities") or {}
        pick = jev["route"].get("choice") or (max(probs, key=probs.get) if probs else None)
        if pick in TIERS:
            tier = pick
            why = f"jev chose tier '{pick}'"
    t = TIERS[tier]
    toks = estimate_tokens(duty)
    return {
        "duty": duty, "tier": tier, "route": t["route"], "model_tier": t["model"],
        "chunking": t["chunking"] and toks > 2000,
        "duty_tokens": toks,
        "why": why,
        "persona": PERSONA_HINTS[tier],
        "skills_to_read": [],
        "memory_queries": [duty[:120]],
        "handoff_trigger_pct": 80,
        "jev": jev,
    }


def maybe_grade(outcome: dict, sample_rate: float | None = None) -> dict:
    """Judge-sampling: grade only a sample of outcomes (default 10%).

    Full-grade triggers regardless of sample: failed outcomes, first use of a
    new tier, or when JEV_GRADE_SAMPLE env overrides the rate (1.0 = grade all).
    Every decision appends to the learning loop log either way.
    """
    import random
    if sample_rate is None:
        sample_rate = float(os.environ.get("JEV_GRADE_SAMPLE", "0.10"))
    force = (not outcome.get("ok", True)) or outcome.get("new_tier") is True
    roll = random.random()
    grade = force or (roll < sample_rate)
    decision = {"roll": round(roll, 4), "sample_rate": sample_rate,
                "forced": force, "grade": grade}
    rec = {**outcome, **decision, "ts": __import__("datetime").datetime.now().isoformat()}
    with open(OUTCOMES_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return decision


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--duty", default="", help="the task/duty text to route")
    ap.add_argument("--with-jev", action="store_true", help="try Jev classification (needs key)")
    ap.add_argument("--explain", action="store_true", help="(default) include routing reasons")
    ap.add_argument("--out")
    ap.add_argument("--outcome", metavar="JSON",
                    help='record outcome for judge sampling, e.g. \'{"duty":"...","tier":"simple","ok":true}\'')
    args = ap.parse_args()
    if args.outcome:
        print(json.dumps(maybe_grade(json.loads(args.outcome)), indent=2))
        return
    if not args.duty:
        ap.error("--duty is required (unless --outcome)")
    plan = build_plan(args.duty, args.with_jev)
    text = json.dumps(plan, indent=2, ensure_ascii=False)
    if args.out:
        open(args.out, "w", encoding="utf-8").write(text)
    print(text)


if __name__ == "__main__":
    main()
