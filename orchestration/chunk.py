#!/usr/bin/env python3
"""Chunk text into token-budgeted pieces with overlap.

Prefers paragraph/section boundaries; hard-splits oversized paragraphs.
Output: JSONL {index, tokens, text} per line (use --out) or stdout.
"""
import argparse
import json
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from tok import estimate_tokens  # noqa: E402


def chunk(text: str, budget: int, overlap: int):
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, cur, cur_tok = [], [], 0
    for p in paras:
        pt = estimate_tokens(p)
        if pt > budget:  # hard-split oversized paragraph by sentences
            sentences = [s.strip() for s in p.replace("? ", "?\n").replace("! ", "!\n")
                         .replace(". ", ".\n").split("\n") if s.strip()]
            for s in sentences:
                st = estimate_tokens(s)
                if cur_tok + st > budget and cur:
                    chunks.append(" ".join(cur)); cur, cur_tok = [], 0
                cur.append(s); cur_tok += st
            continue
        if cur_tok + pt > budget and cur:
            chunks.append("\n\n".join(cur)); cur, cur_tok = [], 0
        cur.append(p); cur_tok += pt
    if cur:
        chunks.append("\n\n".join(cur))
    # add overlap tail from previous chunk
    out = []
    for i, c in enumerate(chunks):
        if i > 0 and overlap > 0:
            prev_tail = chunks[i - 1][-overlap * 4:]
            c = prev_tail + "\n[...]\n" + c
        out.append({"index": i, "tokens": estimate_tokens(c), "text": c})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--budget", type=int, default=3000, help="approx token budget per chunk (greedy; may overshoot one paragraph)")
    ap.add_argument("--overlap", type=int, default=100, help="overlap TOKENS carried from previous chunk")
    ap.add_argument("--out")
    args = ap.parse_args()
    if args.budget < 200:
        sys.exit("[chunk] budget too small (min 200)")
    text = open(args.file, encoding="utf-8").read()
    chunks = chunk(text, args.budget, args.overlap)
    sink = open(args.out, "w", encoding="utf-8") if args.out else sys.stdout
    for c in chunks:
        sink.write(json.dumps(c, ensure_ascii=False) + "\n")
    if args.out:
        sink.close()
        print(json.dumps({"chunks": len(chunks), "out": args.out}))


if __name__ == "__main__":
    main()
