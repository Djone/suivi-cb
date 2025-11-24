#!/usr/bin/env bash

# Quick helper to ensure the local master branch (or any branch passed as argument)
# is in sync with origin before merging.

set -euo pipefail

TARGET_BRANCH="${1:-master}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This script must be run from inside a git repository."
  exit 1
fi

if ! git show-ref --quiet "refs/heads/${TARGET_BRANCH}"; then
  echo "Local branch '${TARGET_BRANCH}' does not exist. Create it or fetch it first."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠️  Working tree is dirty. Commit/stash your changes before checking master."
fi

echo "🔄 Fetching origin/${TARGET_BRANCH}..."
git fetch origin "${TARGET_BRANCH}"

LOCAL_SHA="$(git rev-parse "${TARGET_BRANCH}")"
REMOTE_SHA="$(git rev-parse "origin/${TARGET_BRANCH}")"

if [[ "${LOCAL_SHA}" == "${REMOTE_SHA}" ]]; then
  echo "✅ Local ${TARGET_BRANCH} matches origin/${TARGET_BRANCH}."
else
  echo "❌ Local ${TARGET_BRANCH} is out of sync with origin/${TARGET_BRANCH}."
  echo "Commits missing locally:"
  git --no-pager log --oneline "${TARGET_BRANCH}..origin/${TARGET_BRANCH}" || true
  echo ""
  echo "Commits not pushed:"
  git --no-pager log --oneline "origin/${TARGET_BRANCH}..${TARGET_BRANCH}" || true
  echo ""
  echo "Action required: rebase/merge origin/${TARGET_BRANCH} before merging."
fi

if [[ "${CURRENT_BRANCH}" != "${TARGET_BRANCH}" ]]; then
  echo ""
  echo "ℹ️  Comparing current branch '${CURRENT_BRANCH}' with '${TARGET_BRANCH}'..."
  BEHIND="$(git rev-list --count "${CURRENT_BRANCH}..${TARGET_BRANCH}")"
  AHEAD="$(git rev-list --count "${TARGET_BRANCH}..${CURRENT_BRANCH}")"
  echo "  - ${CURRENT_BRANCH} is ${AHEAD} commit(s) ahead of ${TARGET_BRANCH}"
  echo "  - ${CURRENT_BRANCH} is ${BEHIND} commit(s) behind ${TARGET_BRANCH}"
  if [[ "${BEHIND}" -gt 0 ]]; then
    echo "  ➜ Rebase or merge ${TARGET_BRANCH} into ${CURRENT_BRANCH} before opening the PR."
  fi
fi

echo ""
echo "Done."
