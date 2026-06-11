#!/usr/bin/env bash
#
# install-local.sh — build Fuzzy and (re)install it into /Applications for
# personal use on this Mac. Unsigned/ad-hoc only; no Developer ID, no App Store.
#
#   ./scripts/install-local.sh
#
# Why this isn't just `pnpm build:mac`:
#   - We compile with `electron-vite build` (esbuild), which skips `tsc`, so an
#     in-progress type error elsewhere won't block a local install.
#   - electron-builder's own ad-hoc signing trips on stray extended attributes
#     ("resource fork ... not allowed"), so we strip xattrs and sign ourselves.
#   - On Apple Silicon an app MUST be at least ad-hoc signed to launch.
#
set -euo pipefail

# Run from the repo root regardless of where this is invoked from.
cd "$(dirname "$0")/.."

# Make sure pnpm/node are on PATH even in a stripped shell.
export PATH="/opt/homebrew/bin:$HOME/Library/pnpm:$PATH"
# Cursor/VS Code leak ELECTRON_RUN_AS_NODE=1 into the shell, which makes the
# Electron binary run as plain Node (no window, instant clean exit). Strip it so
# any electron sub-step — and a manual `open` afterward — behaves normally.
unset ELECTRON_RUN_AS_NODE
# Don't let electron-builder hunt for a Developer ID — this is a local build.
export CSC_IDENTITY_AUTO_DISCOVERY=false

APP="dist/mac-arm64/fuzzy.app"
DEST="/Applications/fuzzy.app"

echo "==> Compiling (electron-vite / esbuild, no tsc gate)"
pnpm exec electron-vite build

echo "==> Packaging unpacked .app (electron-builder --dir; ad-hoc sign may warn — ignored)"
# electron-builder's sign step can fail on the resource-fork detritus; we re-sign
# below, so don't let its non-zero exit abort the script.
pnpm exec electron-builder --dir || true

if [ ! -d "$APP" ]; then
  echo "!! Build did not produce $APP" >&2
  ls -la dist/ 2>/dev/null >&2 || true
  exit 1
fi

echo "==> Quitting any running instance"
osascript -e 'quit app "fuzzy"' 2>/dev/null || true
# Give it a moment to release the bundle; force-kill stragglers so ditto can replace it.
for _ in 1 2 3 4 5; do pgrep -f "$DEST/Contents/MacOS/fuzzy" >/dev/null || break; sleep 0.5; done
pkill -f "$DEST/Contents/MacOS/fuzzy" 2>/dev/null || true

# IMPORTANT: this repo lives under ~/Desktop, which is iCloud-synced. The sync
# layer keeps re-stamping `com.apple.FinderInfo` on the bundle, and `codesign`
# refuses to sign a bundle that carries it — `xattr -c` won't even stick on that
# volume. So we copy to /Applications (a plain local volume) FIRST, then strip
# attributes and ad-hoc sign THERE, where the cleared attributes actually stay
# cleared. (Signing in dist/ fails with "resource fork ... not allowed".)
echo "==> Installing to $DEST"
rm -rf "$DEST"
ditto "$APP" "$DEST"

echo "==> Stripping extended attributes + ad-hoc signing (deep) in place"
find "$DEST" -name '._*' -delete 2>/dev/null || true
xattr -cr "$DEST" 2>/dev/null || true
codesign --force --deep --sign - "$DEST"
codesign --verify --deep --strict "$DEST" && echo "   signature OK"

echo "==> Done. Launch with: open \"$DEST\"  (or Spotlight: \"fuzzy\")"
