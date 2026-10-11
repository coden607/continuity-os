#!/usr/bin/env bash
# Continuity OS — one-shot installer
# curl -fsSL https://raw.githubusercontent.com/coden607/continuity-os/main/scripts/install.sh | bash
# Installs: 7 skills into every detected CLI skills dir + the OS scaffold into ~/continuity-os
set -uo pipefail
SRC=""
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; fi
OS_DIR="${CONTINUITY_HOME:-$HOME/continuity-os}"
say(){ printf '\033[1;32m✔\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;31m✖\033[0m %s\n' "$*"; }
have(){ command -v "$1" >/dev/null 2>&1; }

# If invoked via curl pipe, re-exec from a temp clone so $SRC is real
if [[ ! -d "$SRC/skills" ]]; then
  have git || { warn "git required"; exit 1; }
  T="$(mktemp -d)"; git clone -q --depth 1 https://github.com/coden607/continuity-os.git "$T/continuity-os"
  exec bash "$T/continuity-os/scripts/install.sh"
fi

echo "== Continuity OS =="
# --- skills → every detected CLI ---
installed=0
for t in "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.openclaw/skills" "$HOME/.agents/skills" "$HOME/.gemini/antigravity-cli/skills"; do
  mkdir -p "$t"
  for d in "$SRC"/skills/*/; do
    n="$(basename "$d")"; rm -rf "$t/$n"; cp -R "$d" "$t/$n" && installed=$((installed+1))
  done
  say "skills → $t"
done

# --- OS scaffold ---
mkdir -p "$OS_DIR"/{orchestration/archon,rag,guardrails,integrations,learning,hooks,second-brain/daily,second-brain/knowledge-base,factory/prd,factory/missions,config/orchestration}
cp -R "$SRC/orchestration/"* "$OS_DIR/orchestration/" 2>/dev/null || true
cp -R "$SRC/rag/"* "$OS_DIR/rag/" 2>/dev/null || true
cp -R "$SRC/guardrails/"* "$OS_DIR/guardrails/" 2>/dev/null || true
cp -R "$SRC/integrations/"* "$OS_DIR/integrations/" 2>/dev/null || true
cp -R "$SRC/learning/"* "$OS_DIR/learning/" 2>/dev/null || true
cp -R "$SRC/second-brain/"* "$OS_DIR/second-brain/" 2>/dev/null || true
cp "$SRC/config/orchestration/models.yaml" "$OS_DIR/config/orchestration/models.yaml" 2>/dev/null || true
cp "$SRC/hooks/event-map.json" "$SRC/hooks/README.md" "$OS_DIR/hooks/" 2>/dev/null || true
[ -f "$OS_DIR/orchestration/outcomes.jsonl" ] || : > "$OS_DIR/orchestration/outcomes.jsonl"
for f in second-brain/MEMORY.template.md second-brain/daily/YYYY-MM-DD.template.md second-brain/kb/README.md \
         factory/GLOBAL_RULES.md factory/FACTORY_RULES.md factory/missions/mission.template.md factory/prd/PRD-001-UNIVERSAL-FOUNDATION.md; do
  [ -f "$SRC/$f" ] && [ ! -f "$OS_DIR/$f" ] && cp "$SRC/$f" "$OS_DIR/$f"
done
say "OS scaffold → $OS_DIR (existing files preserved)"

# --- python dependencies ---
if python3 -c "import pydantic" >/dev/null 2>&1; then
  say "pydantic available"
else
  if have pip3 || have pip; then
    pip3 install --break-system-packages -q pydantic 2>/dev/null || pip install -q pydantic 2>/dev/null || true
  fi
fi

# --- sanity ---
if python3 "$OS_DIR/orchestration/dispatch.py" --duty "install smoke test" >/dev/null 2>&1; then
  say "dispatch.py routes (test duty OK)"; rm -rf "$OS_DIR/orchestration/__pycache__"
else
  warn "dispatch.py test failed — check python3"
fi
if python3 "$OS_DIR/orchestration/bridge.py" brain-audit >/dev/null 2>&1; then
  say "agentic bridge operational (Second Brain audit OK)"
fi

echo
echo "NEXT: 1) edit $OS_DIR/config/orchestration/models.yaml with your models"
echo "      2) copy templates: MEMORY.template.md → your MEMORY.md, daily/ → memory/"
echo "      3) route duties: python3 $OS_DIR/orchestration/dispatch.py --duty \"your task\" --with-jev"
echo "      4) skills activate on next CLI session boot"
