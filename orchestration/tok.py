#!/usr/bin/env python3
"""Token estimation and budget checks (no external deps).

Estimates are heuristic: CJK chars ~1 token, other chars ~4 per token,
plus small per-message overhead. Good enough for routing/budgeting.
"""
import argparse
import json
import sys


def estimate_tokens(text: str) -> int:
    cjk = sum(1 for c in text if '\u4e00' <= c <= '\u9fff' or '\u3000' <= c <= '\u303f'
              or '\uff00' <= c <= '\uffef')
    rest = len(text) - cjk
    return max(1, round(cjk * 1.0 + rest / 4))


# context windows (tokens) for common models — extend as needed
CONTEXT = {
    "kimi-k2": 262144, "k2d8": 262144,
    "claude-sonnet-4": 200000, "claude-opus": 200000,
    "gpt-4o": 128000, "gpt-5": 400000,
    "gemini-flash": 1000000, "gemini-pro": 2000000,
    "grok-4": 256000, "llama-3.3-70b": 128000,
}


def budget(used: int, max_tokens: int) -> dict:
    pct = round(100 * used / max_tokens, 1) if max_tokens else 100.0
    verdict = "handoff" if pct >= 80 else ("warn" if pct >= 60 else "ok")
    return {"used": used, "max": max_tokens, "pct": pct, "remaining": max_tokens - used,
            "verdict": verdict}


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("estimate")
    e.add_argument("text", nargs="?", help="text, or omit with --file")
    e.add_argument("--file")
    b = sub.add_parser("budget")
    b.add_argument("--used", type=int, required=True)
    b.add_argument("--max", type=int, required=True)
    sub.add_parser("contexts")
    args = ap.parse_args()

    if args.cmd == "estimate":
        if args.file:
            text = open(args.file, encoding="utf-8").read()
        elif args.text:
            text = args.text
        else:
            sys.exit("[tok] provide text or --file")
        print(json.dumps({"tokens": estimate_tokens(text), "chars": len(text)}))
    elif args.cmd == "budget":
        print(json.dumps(budget(args.used, args.max)))
    elif args.cmd == "contexts":
        print(json.dumps(CONTEXT, indent=2))


if __name__ == "__main__":
    main()
