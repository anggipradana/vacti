#!/usr/bin/env sh
# Block committing any .env* file except .env.example.
set -e
staged=$(git diff --cached --name-only)
bad=$(echo "$staged" | grep -E '(^|/)\.env($|\.)' | grep -v -E '(^|/)\.env\.example$' || true)
if [ -n "$bad" ]; then
  echo "❌ Refusing to commit secret env files:"
  echo "$bad"
  echo "Only .env.example may be committed."
  exit 1
fi
