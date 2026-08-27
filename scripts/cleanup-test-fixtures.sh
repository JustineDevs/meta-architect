#!/usr/bin/env bash
set -euo pipefail

REQUESTED_TMP_DIR="${MA_TEST_ROOT:-/tmp/ma-tests}"
MAX_SIZE_BYTES=$((2 * 1024 * 1024 * 1024))

case "$REQUESTED_TMP_DIR" in
  /tmp/ma-tests|/tmp/ma-tests/*) ;;
  *) echo "Refusing to clean unexpected path: $REQUESTED_TMP_DIR" >&2; exit 2 ;;
esac

TMP_DIR=$(node -e 'const path = require("node:path"); process.stdout.write(path.resolve(process.argv[1]));' "$REQUESTED_TMP_DIR")
case "$TMP_DIR" in
  /tmp/ma-tests|/tmp/ma-tests/*) ;;
  *) echo "Refusing to clean resolved path: $TMP_DIR" >&2; exit 2 ;;
esac

if [ ! -d "$TMP_DIR" ]; then
  echo "Test fixture root does not exist: $TMP_DIR"
  exit 0
fi

find "$TMP_DIR" -type f \( -name '*.tar.zst' -o -name '*.tar.gz' \) -mtime +7 -delete
find "$TMP_DIR" -type f -name '*.log' -mtime +3 -delete
namespace_is_active() {
  local namespace="$1"
  local pid
  if [ ! -f "$namespace/.active" ]; then return 1; fi
  pid=$(cat "$namespace/.active" 2>/dev/null || true)
  [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null
}

prune_namespaces_older_than() {
  local age_minutes="$1"
  local namespace
  shopt -s nullglob
  for namespace in "$TMP_DIR"/*; do
    [ -d "$namespace" ] || continue
    [ "$(basename "$namespace")" = retained ] && continue
    namespace_is_active "$namespace" && continue
    find "$namespace" -maxdepth 0 -type d -mmin +"$age_minutes" -exec rm -rf -- {} +
  done
}

# Retained archives have their own seven-day policy and are not namespaces.
prune_namespaces_older_than 1440

CURRENT_KIB=$(du -sk "$TMP_DIR" 2>/dev/null | cut -f1 || echo 0)
CURRENT_BYTES=$((CURRENT_KIB * 1024))
echo "Current $TMP_DIR usage: $CURRENT_BYTES bytes"

if [ "$CURRENT_BYTES" -gt "$MAX_SIZE_BYTES" ]; then
  echo "::warning::$TMP_DIR exceeded 2GB; removing expired namespaces"
  prune_namespaces_older_than 60
fi
