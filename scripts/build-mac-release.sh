#!/usr/bin/env bash
#
# Build a signed + notarized macOS DMG for website distribution.
#
#   cp .env.signing.example .env.signing   # fill in values once
#   pnpm build:mac:release
#
set -euo pipefail

cd "$(dirname "$0")/.."

export PATH="/opt/homebrew/bin:$HOME/Library/pnpm:$PATH"
unset ELECTRON_RUN_AS_NODE

ENV_FILE="${1:-.env.signing}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  echo "Copy .env.signing.example to .env.signing and fill in your Apple credentials." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${CSC_LINK:-}" && -z "${CSC_NAME:-}" ]]; then
  echo "Set CSC_LINK (path to Developer ID Application .p12) or CSC_NAME in $ENV_FILE" >&2
  exit 1
fi

if [[ -n "${CSC_LINK:-}" && -z "${CSC_KEY_PASSWORD:-}" ]]; then
  echo "Set CSC_KEY_PASSWORD in $ENV_FILE when using CSC_LINK" >&2
  exit 1
fi

has_api_key=false
has_apple_id=false
if [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_KEY_ISSUER:-}" ]]; then
  has_api_key=true
fi
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then
  has_apple_id=true
fi

if ! $has_api_key && ! $has_apple_id; then
  echo "Set notarization credentials in $ENV_FILE:" >&2
  echo "  - APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_KEY_ISSUER (preferred), or" >&2
  echo "  - APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID" >&2
  exit 1
fi

echo "==> Preflight checks"

disk_avail_gb="$(df -Pg . | awk 'NR==2 {print int($4)}')"
if [[ "$disk_avail_gb" -lt 8 ]]; then
  echo "ERROR: Only ${disk_avail_gb} GB free. Need at least 8 GB before building." >&2
  echo "  macOS Settings → General → Storage" >&2
  exit 1
fi

disk_used="$(df -P . | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if [[ "$disk_used" -ge 95 ]]; then
  echo "WARNING: Disk is ${disk_used}% full (${disk_avail_gb} GB free). Build may be slow." >&2
fi

if [[ "$PWD" == "$HOME/Desktop"* ]]; then
  echo "WARNING: Building from ~/Desktop (often iCloud-synced). This can hang with no output." >&2
  echo "  If the build stalls, move the repo to ~/Projects/Fuzzy and retry." >&2
fi

# iCloud conflict folders can break packaging
find out -maxdepth 1 -name '* 2' -type d -exec rm -rf {} + 2>/dev/null || true

echo "==> Checking build tools respond (30s timeout)"
if ! perl -e 'alarm shift; exec @ARGV' 30 pnpm exec electron-vite --version >/dev/null 2>&1; then
  echo "ERROR: electron-vite is not responding." >&2
  echo "  1. Press Ctrl+C if a previous build is still running" >&2
  echo "  2. Free disk space (need ~10 GB free)" >&2
  echo "  3. Move repo off ~/Desktop: mv ~/Desktop/Projects/Fuzzy ~/Projects/Fuzzy" >&2
  echo "  4. Retry from the new location" >&2
  exit 1
fi

echo "==> Compiling app (electron-vite)"
pnpm exec electron-vite build

echo "==> Packaging, signing, and notarizing (electron-builder — can take several minutes)"
pnpm exec electron-builder --mac

DMG=(dist/*.dmg)
if [[ -e "${DMG[0]}" ]]; then
  echo ""
  echo "==> Built: ${DMG[0]}"
  echo "==> Verify with:"
  echo "    spctl -a -vv -t install \"${DMG[0]}\""
else
  echo "Build finished but no DMG found in dist/" >&2
  ls -la dist/ >&2 || true
  exit 1
fi
