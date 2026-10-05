#!/usr/bin/env python3
"""Send typed decisions to Jev (TypeSafe System One) via OpenRouter.

Jev is a decision model, not a chat model: you send `state` plus typed
questions, it returns calibrated probabilities (noul / choice / score).

Usage:
  jev_decide.py --state "ticket text" \
      --questions '{"urgent": {"type": "noul", "instructions": "Is this urgent?"}}'

  jev_decide.py --state @section.txt --questions @qs.json
  jev_decide.py --selftest
  jev_decide.py --base-url http://localhost:9999/mock   # for tests/mocks

Input:
  --state     plain string, or @path (text file, or .json for structured state)
  --questions JSON object: {key: {type: noul|choice|score, instructions, criteria}}
              - noul:    yes/no probability 0..1
              - choice:  criteria = {option: definition} map
              - score:   criteria = ordered list of level descriptions

Output (stdout): the full API response JSON (answers + usage + cost).
Exit codes: 0 ok | 3 missing key / bad input | 4 API error
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_BASE = "https://openrouter.ai/api"
MODEL = "typesafe/jev-1.13"
KEY_ENV = "OPENROUTER_API_KEY"
# also honored: a key file written by the user/agent (chmod 600)
KEY_FILES = [os.path.expanduser("~/.config/jev/api_key"), os.path.expanduser("~/.openclaw/workspace/.jev_key")]


def die(msg: str, code: int = 3):
    print(f"[jev] {msg}", file=sys.stderr)
    sys.exit(code)


def load_arg(value: str):
    """--state / --questions value: literal, or @file."""
    if value.startswith("@"):
        path = value[1:]
        try:
            raw = open(path, encoding="utf-8").read()
        except OSError as e:
            die(f"cannot read {path}: {e}")
        if path.endswith(".json"):
            return json.loads(raw)
        return raw
    return value


def load_key(explicit: str | None) -> str:
    if explicit:
        return explicit
    if os.environ.get(KEY_ENV):
        return os.environ[KEY_ENV]
    for f in KEY_FILES:
        if os.path.exists(f):
            return open(f).read().strip()
    die(f"no API key. Set {KEY_ENV}, pass --key, or write the key to {KEY_FILES[1]} (chmod 600).")


def decide(base: str, key: str, model: str, state, questions: dict):
    body = json.dumps({"model": model, "state": state, "questions": questions}).encode()
    req = urllib.request.Request(
        base.rstrip("/") + "/v1/systemone", data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:500]
        print(f"[jev] API error {e.code}: {detail}", file=sys.stderr)
        sys.exit(4)
    except urllib.error.URLError as e:
        print(f"[jev] connection failed: {e.reason}", file=sys.stderr)
        sys.exit(4)


def main():
    ap = argparse.ArgumentParser(description="Ask Jev typed decision questions.")
    ap.add_argument("--state", help="state text, or @file (txt/json)")
    ap.add_argument("--questions", help='JSON: {"key": {"type": "noul|choice|score", ...}}')
    ap.add_argument("--key", help="OpenRouter API key (default: env/file)")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--base-url", default=DEFAULT_BASE, help="override endpoint base")
    ap.add_argument("--selftest", action="store_true", help="tiny canned request to verify the key")
    args = ap.parse_args()

    key = load_key(args.key)

    if args.selftest:
        state = "A customer says their screen goes black when they press Pay."
        questions = {
            "is_bug": {"type": "noul", "instructions": "Is the customer reporting a defect?"},
        }
        resp = decide(args.base_url, key, args.model, state, questions)
        print(json.dumps(resp, indent=2))
        ans = resp.get("answers", {}).get("is_bug", {})
        print(f"[jev] selftest OK — is_bug={ans.get('noul')} cost=${resp.get('usage', {}).get('cost')}", file=sys.stderr)
        return

    if not args.state or not args.questions:
        ap.error("--state and --questions are required (or use --selftest)")
    state = load_arg(args.state)
    questions = load_arg(args.questions)
    if isinstance(questions, str):
        try:
            questions = json.loads(questions)
        except json.JSONDecodeError as e:
            die(f"--questions is not valid JSON: {e}")
    if not isinstance(questions, dict) or not questions:
        die('--questions must be a JSON object like {"q1": {"type": "noul", "instructions": "..."}}')
    for k, q in questions.items():
        if q.get("type") not in ("noul", "choice", "score"):
            die(f'question "{k}": type must be noul|choice|score')

    resp = decide(args.base_url, key, args.model, state, questions)
    print(json.dumps(resp, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
