#!/usr/bin/env python3
"""
Token Optimizer & Spend Discipline Engine (compress-token-spend).
Analyzes prompt tokens, pricing across tiers, caching hit structure,
and recommends cheapest capable execution path.
"""

import sys
import json
import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from tok import estimate_tokens, CONTEXT

# Pricing per million tokens (estimated blended market rates)
TIER_PRICING = {
    "jev": {
        "name": "Jev System-One Decision",
        "input_per_m": 0.05,
        "output_per_m": 0.05,
        "per_call_est": 0.0001,
        "latency_est_ms": 60,
    },
    "small_fast": {
        "name": "Fast / Small Tier (e.g., Flash, Haiku, Mini)",
        "input_per_m": 0.15,
        "output_per_m": 0.60,
        "latency_est_ms": 300,
    },
    "standard": {
        "name": "Standard Tier (e.g., Sonnet, GPT-4o, Llama 70B)",
        "input_per_m": 3.00,
        "output_per_m": 15.00,
        "latency_est_ms": 1200,
    },
    "frontier": {
        "name": "Frontier Heavy (e.g., Opus, O1, O3)",
        "input_per_m": 15.00,
        "output_per_m": 60.00,
        "latency_est_ms": 3500,
    }
}

def analyze_prompt(text: str, expected_output_tokens: int = 500) -> dict:
    input_tokens = estimate_tokens(text)
    char_count = len(text)
    
    # Calculate costs
    def calc_cost(tier_key: str) -> float:
        rate = TIER_PRICING[tier_key]
        in_cost = (input_tokens / 1_000_000) * rate["input_per_m"]
        out_cost = (expected_output_tokens / 1_000_000) * rate["output_per_m"]
        return round(in_cost + out_cost, 6)

    cost_frontier = calc_cost("frontier")
    cost_standard = calc_cost("standard")
    cost_fast = calc_cost("small_fast")
    cost_jev = TIER_PRICING["jev"]["per_call_est"]

    # Savings comparison
    savings_vs_frontier = round(((cost_frontier - cost_fast) / cost_frontier) * 100, 1) if cost_frontier else 0
    savings_with_jev = round(((cost_frontier - cost_jev) / cost_frontier) * 100, 1) if cost_frontier else 0

    # Caching readiness analysis
    lines = text.strip().splitlines()
    has_clear_instructions = any(l.startswith(('#', 'You are', 'System', 'Rules')) for l in lines[:5])
    recommendations = []

    if input_tokens > 2000:
        recommendations.append("High context length (>2k tokens). Chunk documents or search before full dump.")
    else:
        recommendations.append("Context size is compact and cache-friendly.")

    if has_clear_instructions:
        recommendations.append("Stable prefix detected: Prompt is structured for high provider prompt-caching hits.")
    else:
        recommendations.append("Cache Tip: Place static system instructions and rules at the very top of the prompt.")

    recommendations.append("Output Discipline: Output tokens cost 3-5x input tokens. Keep agent output concise.")
    recommendations.append("Sampling Discipline: For grading loops, evaluate a 10% random sample, not 100%.")

    # Classification check
    is_classification = any(w in text.lower() for w in ["classify", "route", "choose", "gate", "select", "decide", "approve", "reject"])
    if is_classification:
        recommendations.append("High-Leverage Optimization: This task appears to be a decision/classification. Route through Jev (~1/1000th LLM cost).")

    return {
        "input_tokens": input_tokens,
        "char_count": char_count,
        "expected_output_tokens": expected_output_tokens,
        "is_classification": is_classification,
        "costs": {
            "frontier": cost_frontier,
            "standard": cost_standard,
            "fast": cost_fast,
            "jev": cost_jev
        },
        "savings_percentage": {
            "fast_vs_frontier": savings_vs_frontier,
            "jev_vs_frontier": savings_with_jev
        },
        "recommendations": recommendations,
        "context_fit": {
            "claude_sonnet": round((input_tokens / CONTEXT["claude-sonnet-4"]) * 100, 2),
            "gemini_flash": round((input_tokens / CONTEXT["gemini-flash"]) * 100, 2),
            "gpt_4o": round((input_tokens / CONTEXT["gpt-4o"]) * 100, 2)
        }
    }

def main():
    parser = argparse.ArgumentParser(description="Token Spend Optimizer")
    parser.add_argument("text", nargs="?", help="Prompt text or omit with --file")
    parser.add_argument("--file", help="Path to prompt file")
    parser.add_argument("--output-tokens", type=int, default=500, help="Expected response token count")
    args = parser.parse_args()

    content = ""
    if args.file:
        content = Path(args.file).read_text(encoding="utf-8")
    elif args.text:
        content = args.text
    else:
        content = sys.stdin.read()

    result = analyze_prompt(content, args.output_tokens)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
