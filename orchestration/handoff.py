#!/usr/bin/env python3
"""Build a handoff package so a FRESH agent can continue with zero history.

Writes handoff.md (human+agent readable) and state.json (machine readable).
A fresh agent given only handoff.md must be able to pick up the work.
"""
import argparse
import datetime
import json
import os
import sys


def build(goal, decisions, artifacts, pending, constraints, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    decisions = [d for d in decisions.split(";") if d.strip()]
    artifacts = [a for a in artifacts.split(",") if a.strip()]
    pending = [p for p in pending.split("|") if p.strip()]
    constraints = [c for c in constraints.split(";") if c.strip()]
    state = {"goal": goal, "decisions": decisions, "artifacts": artifacts,
             "pending": pending, "constraints": constraints,
             "handoff_time": datetime.datetime.now().isoformat(timespec="seconds")}
    md = [f"# HANDOFF — {state['handoff_time']}", "", f"## Goal\n{goal}", "", "## Decisions made"]
    md += [f"- {d}" for d in decisions] or ["- (none recorded)"]
    md += ["", "## Artifacts (paths)"]
    md += [f"- `{a}`" for a in artifacts] or ["- (none)"]
    md += ["", "## Still pending (do these next)"]
    md += [f"- [ ] {p}" for p in pending] or ["- (nothing)"]
    md += ["", "## Constraints & context"]
    md += [f"- {c}" for c in constraints] or ["- (none)"]
    md += ["", "_You are continuing mid-task. Start with the pending items._"]
    open(os.path.join(out_dir, "handoff.md"), "w", encoding="utf-8").write("\n".join(md))
    open(os.path.join(out_dir, "state.json"), "w", encoding="utf-8").write(
        json.dumps(state, indent=2, ensure_ascii=False))
    return state


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build"])
    ap.add_argument("--goal", required=True)
    ap.add_argument("--decisions", default="")
    ap.add_argument("--artifacts", default="")
    ap.add_argument("--pending", default="")
    ap.add_argument("--constraints", default="")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    if not args.goal.strip():
        sys.exit("[handoff] --goal required")
    state = build(args.goal, args.decisions, args.artifacts, args.pending,
                  args.constraints, args.out)
    print(json.dumps({"handoff": os.path.join(args.out, "handoff.md"),
                      "pending_items": len(state["pending"])}))


if __name__ == "__main__":
    main()
