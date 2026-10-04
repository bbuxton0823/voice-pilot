#!/usr/bin/env bash
# Publishes this folder as a public GitHub repo under your account.
# Needs: git and the GitHub CLI (https://cli.github.com). Usage: ./publish.sh [repo-name]
set -euo pipefail
REPO="${1:-voice-pilot}"
cd "$(dirname "$0")"

command -v git >/dev/null || { echo "Please install git first."; exit 1; }
command -v gh  >/dev/null || { echo "Please install the GitHub CLI first: https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || gh auth login

# Last check before going public: refuse to publish anything that looks like a key.
if grep -rIlE "apikey_[0-9a-f]{20,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----" \
     --exclude-dir=node_modules --exclude-dir=.git . ; then
  echo "Stopped: the files above look like they contain a secret key. Remove it, then run again."
  exit 1
fi

[ -d .git ] || git init -q -b main
git add -A
git commit -q -m "Voice Pilot: hands-free voice control for NSPIRE inspection apps" || echo "(nothing new to commit)"
gh repo create "$REPO" --public --source . --remote origin --push \
  --description "Hands-free voice control for NSPIRE inspection apps: earbuds, local matching, HQS-to-NSPIRE phrases, Jev fallback, Kokoro voice, reviewed learning loop."
echo "Published: $(gh repo view "$REPO" --json url -q .url)"
