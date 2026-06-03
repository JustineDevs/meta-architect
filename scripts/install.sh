#!/usr/bin/env sh
set -eu

MA_PACKAGE="${MA_PACKAGE:-@jstn-sdk/ma@latest}"
CODEX_PACKAGE="${CODEX_PACKAGE:-@openai/codex@latest}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "meta-architect install: missing required command: $1" >&2
    exit 1
  }
}

need_cmd npm
need_cmd node

echo "meta-architect install: installing Codex + Meta-Architect"
npm i -g "$CODEX_PACKAGE" "$MA_PACKAGE"

if command -v ma >/dev/null 2>&1; then
  echo "meta-architect install: seeding local MA runtime"
  ma setup >/dev/null
  echo "meta-architect install: ready"
  echo "start: ma --madmax --high"
else
  echo "meta-architect install: ma command not found after npm install" >&2
  exit 1
fi
