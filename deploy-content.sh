#!/usr/bin/env bash
# Push updated content to the private content repo, which the GitHub Actions
# pipeline pulls to deploy. Run this after adding/transforming courses.
#
#   ./deploy-content.sh
#
# What it does (content path only — code changes deploy automatically on git push):
#   1. regenerate content.json from the local transformed/ tree
#   2. push it to the PRIVATE ai-arcade-content repo
#   3. trigger the deploy workflow
#
# Raw source, .env, and API keys never leave your machine. Only the derived
# content.json is pushed, and only to the PRIVATE repo.
set -euo pipefail
cd "$(dirname "$0")"

CONTENT_REPO="git@github.com:iamr1ddl3/ai-arcade-content.git"
WORK="${TMPDIR:-/tmp}/ai-arcade-content-push"

echo "1/3  Generating content.json from transformed/ ..."
python3 arcade/generate_content.py --root transformed --out arcade/data/content.json
test -s arcade/data/content.json

echo "2/3  Pushing content.json to private repo ..."
rm -rf "$WORK"
git clone -q "$CONTENT_REPO" "$WORK"
cp arcade/data/content.json "$WORK/content.json"
git -C "$WORK" add content.json
if git -C "$WORK" diff --cached --quiet; then
  echo "     content unchanged — nothing to push."
else
  git -C "$WORK" commit -q -m "content update $(date -u +%Y-%m-%dT%H:%MZ)"
  git -C "$WORK" push -q origin main
  echo "     pushed."
fi

echo "3/3  Triggering deploy pipeline ..."
gh workflow run deploy.yml --repo iamr1ddl3/ai-arcade
echo "Done. Watch: gh run watch --repo iamr1ddl3/ai-arcade"
