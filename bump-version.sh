#!/usr/bin/env bash
# Bump cache-busting version string (?v=...) across pages/*.html.
# Usage: ./bump-version.sh <new-version>
#   e.g. ./bump-version.sh 20260521a

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <new-version>" >&2
  exit 1
fi

export NEW="$1"
DIR="$(cd "$(dirname "$0")" && pwd)"

perl -i -pe 's{(styles\.css|app\.js|content\.js)\?v=[A-Za-z0-9._-]+}{"$1?v=$ENV{NEW}"}ge' "$DIR"/pages/*.html

echo "Bumped to ?v=$NEW across $DIR/pages/*.html"
