#!/usr/bin/env sh
set -eu

MA_PACKAGE="${MA_PACKAGE:-@jstn-sdk/ma@0.14.0}"
CODEX_PACKAGE="${CODEX_PACKAGE:-@openai/codex@latest}"
NO_SETUP=0
NO_SKILLS=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --no-setup) NO_SETUP=1 ;;
    --no-skills) NO_SKILLS=1 ;;
    --dry-run) DRY_RUN=1 ;;
    *) echo "meta-architect install: unknown option: $arg" >&2; exit 2 ;;
  esac
done

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "meta-architect install: missing required command: $1" >&2
    exit 1
  }
}

need_cmd npm
need_cmd node

echo "meta-architect install: plan"
echo "  install: $CODEX_PACKAGE $MA_PACKAGE"
echo "  setup: $([ "$NO_SETUP" -eq 1 ] && echo disabled || echo enabled)"
echo "  skills: $([ "$NO_SKILLS" -eq 1 ] && echo disabled || echo enabled)"
echo "  undo: npm uninstall -g $MA_PACKAGE $CODEX_PACKAGE"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "meta-architect install: dry-run complete"
  exit 0
fi

if [ "$NO_SKILLS" -eq 1 ]; then export MA_SKIP_SKILLS=1; fi
npm i -g "$CODEX_PACKAGE" "$MA_PACKAGE"
echo "meta-architect install: versions"
node --version
npm --version
command -v codex >/dev/null 2>&1 && codex --version || echo "codex: unavailable"

if command -v ma >/dev/null 2>&1 && [ "$NO_SETUP" -eq 0 ]; then
  echo "meta-architect install: seeding local MA runtime"
  ma setup
  echo "meta-architect install: ready"
  echo "start: ma --madmax --high"
elif [ "$NO_SETUP" -eq 1 ]; then
  echo "meta-architect install: setup disabled by --no-setup"
else
  echo "meta-architect install: ma command not found after npm install" >&2
  exit 1
fi
