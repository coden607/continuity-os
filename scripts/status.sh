#!/usr/bin/env bash
# continuity status — boot screen + live health check
OS_DIR="${CONTINUITY_HOME:-$HOME/continuity-os}"
G="\033[1;32m"; B="\033[1;34m"; C="\033[1;36m"; D="\033[2m"; Y="\033[1;33m"; R="\033[0m"
ok(){ echo -e "  ${G}●${R} $1"; }; dim(){ echo -e "  ${D}$1${R}"; }; warn(){ echo -e "  ${Y}▲${R} $1"; }
[ -d "$OS_DIR" ] || { echo "Continuity OS not found at $OS_DIR — run:"; echo '  curl -fsSL https://raw.githubusercontent.com/coden607/continuity-os/main/scripts/install.sh | bash'; exit 1; }

echo -e "${B}  ╔══════════════════════════════════════════════════╗${R}"
echo -e "${B}  ║${C}   🧠 CONTINUITY OS${R}${D} v1.0 · coden607 · LIVE${R}${B}      ║${R}"
echo -e "${B}  ╚══════════════════════════════════════════════════╝${R}"
echo
echo -e "${C}  BOOT${R}"
cli=0; for t in "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.openclaw/skills"; do
  [ -d "$t" ] && c=$(ls "$t" 2>/dev/null | grep -cE "^(route-with-jev|maintain-second-brain|isolate-agent-runs|run-software-factory|enforce-with-hooks|route-interrupts|compress-token-spend)$") && [ "$c" -eq 7 ] && cli=$((cli+1)); done
ok "7 skills armed across $cli/3 CLI skill dirs"
ref=$(grep -m1 'Refreshed:' "$OS_DIR/config/orchestration/models.yaml" 2>/dev/null | cut -d: -f2- | xargs)
tiers=$(grep -c "^    when:" "$OS_DIR/config/orchestration/models.yaml" 2>/dev/null)
ok "models.yaml: $tiers tiers mapped (refreshed $ref)"
if plan=$(python3 "$OS_DIR/orchestration/dispatch.py" --duty "continuity status heartbeat" 2>/dev/null); then
  t=$(echo "$plan" | python3 -c "import sys,json;print(json.load(sys.stdin)['tier'])")
  r=$(echo "$plan" | python3 -c "import sys,json;print(json.load(sys.stdin)['route'])")
  rm -rf "$OS_DIR/orchestration/__pycache__"
  ok "dispatch.py routing LIVE (heartbeat → tier=$t, route=$r)"
else warn "dispatch.py heartbeat failed — check python3"; fi
oc=0; [ -f "$OS_DIR/orchestration/outcomes.jsonl" ] && oc=$(grep -c . "$OS_DIR/orchestration/outcomes.jsonl")
ok "judge sampling armed (10% random, failures forced) — $oc outcomes logged"
if [ -f "$OS_DIR/hooks/event-map.json" ]; then
  ev=$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))['events']))" "$OS_DIR/hooks/event-map.json" 2>/dev/null || echo "?")
  ok "hooks event-map loaded ($ev events → regex/Jev/LLM ladder)"
else
  warn "hooks event-map missing"
fi
echo
echo -e "${C}  LAYERS${R}"
dim "ROUTE     · route-with-jev        decisions → Jev at ~1/1000th LLM cost"
dim "REMEMBER  · maintain-second-brain state vs events; weekly contradiction pull"
dim "ISOLATE   · isolate-agent-runs    yolo agents in the 200-300K dumb zone"
dim "BUILD     · run-software-factory  PRD→PR, autonomy levels, mission log"
dim "ENFORCE   · enforce-with-hooks    events > prompts; cheapest rung first"
dim "INTERRUPT · route-interrupts      new work queues — never silently kills"
dim "SPEND     · compress-token-spend  10% sampling · cache structure · output discipline"
echo
echo -e "${C}  NEXT${R}"
dim "route a duty:  python3 $OS_DIR/orchestration/dispatch.py --duty \"your task\" --with-jev"
dim "monthly price review cron: 17 9 1 * * (Asia/Shanghai)"
echo
