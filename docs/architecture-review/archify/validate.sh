#!/usr/bin/env bash
# Validate one Archify candidate against the showcase profile and its pinned repository.
# usage: validate.sh <type> <name> <repo-root>
cd "$(dirname "$0")/../../.." || exit 1
node "$HOME/.agents/skills/archify/bin/archify.mjs" validate "$1" "docs/architecture-review/archify/$2.json" --repo-root "$3" --quality showcase --json
