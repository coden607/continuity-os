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
for t in "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.openclaw/skills"; do
  mkdir -p "$t"
  for d in "$SRC"/skills/*/; do
    n="$(basename "$d")"; rm -rf "$t/$n"; cp -R "$d" "$t/$n" && installed=$((installed+1))
  done
  say "skills → $t"
done

# --- OS scaffold ---
mkdir -p "$OS_DIR"/{orchestration,hooks,second-brain/daily,second-brain/kb,factory/missions,config/orchestration}
for p in "$SRC"/orchestration/*.py; do cp "$p" "$OS_DIR/orchestration/"; done
cp "$SRC/config/orchestration/models.yaml" "$OS_DIR/config/orchestration/models.yaml"
cp "$SRC/hooks/event-map.json" "$OS_DIR/hooks/"
[ -f "$OS_DIR/orchestration/outcomes.jsonl" ] || : > "$OS_DIR/orchestration/outcomes.jsonl"
for f in second-brain/MEMORY.template.md second-brain/daily/YYYY-MM-DD.template.md second-brain/kb/README.md \
         factory/GLOBAL_RULES.md factory/FACTORY_RULES.md factory/missions/mission.template.md; do
  base="$(basename "$f")"; [ -f "$OS_DIR/$f" ] || cp "$SRC/$f" "$OS_DIR/$f"
done
say "OS scaffold → $OS_DIR (existing files preserved)"

# --- sanity ---
if python3 "$OS_DIR/orchestration/dispatch.py" --duty "install smoke test" >/dev/null 2>&1; then
  say "dispatch.py routes (test duty OK)"; rm -rf "$OS_DIR/orchestration/__pycache__"
else
  warn "dispatch.py test failed — check python3"
fi

echo
echo "NEXT: 1) edit $OS_DIR/config/orchestration/models.yaml with your models"
echo "      2) copy templates: MEMORY.template.md → your MEMORY.md, daily/ → memory/"
echo "      3) route duties: python3 $OS_DIR/orchestration/dispatch.py --duty \"your task\" --with-jev"
echo "      4) skills activate on next CLI session boot"
