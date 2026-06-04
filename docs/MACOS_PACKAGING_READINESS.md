# macOS Packaging Readiness — 2026-06-03

## Current configuration

| Item | Value |
|---|---|
| App ID | `com.fuzzy.study` (updated from `com.electron.app`) |
| Product name | `fuzzy` |
| Notarize | `false` in `electron-builder.yml` |
| Signing | Not configured in CI |
| Sample PDF | `resources/sample-document.pdf` → `extraResources` |
| Camera/mic plist strings | Removed (not used) |

## Icon readiness

- `build/icon.icns` / `resources/icon.png` — verify assets before marketing builds.

## Local unsigned build

```bash
pnpm build
pnpm build:mac   # or build:unpack for dir output
```

Expect an **unsigned** DMG suitable for local testing only.

## Remaining steps for private beta DMG

1. Enroll in Apple Developer Program.
2. Create Developer ID Application certificate.
3. Set environment variables in CI or local shell:
   - `CSC_LINK` / `CSC_KEY_PASSWORD`
   - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
4. Set `mac.notarize: true` in `electron-builder.yml`.
5. Add `.github/workflows/release-mac.yml` on tag push.
6. Staple notarization ticket and smoke-install on a clean Mac.

## Honest status

Fuzzy is **not** signed or notarized today. Do not distribute the DMG outside your team until the steps above are complete.
