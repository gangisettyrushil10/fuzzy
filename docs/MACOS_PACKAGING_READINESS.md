# macOS Packaging Readiness

## Current configuration

| Item | Value |
|---|---|
| App ID | `com.fuzzy.study` |
| Product name | `fuzzy` |
| Unsigned local build | `pnpm build:mac` |
| Signed + notarized release | `pnpm build:mac:release` |
| Notarize | enabled in `electron-builder.yml` for release builds |

## One-time Apple setup (Humyn LLC)

1. [Apple Developer](https://developer.apple.com/account) → **Certificates** → create **Developer ID Application** (not Mac App Store).
2. Download/install the cert, then export it as a `.p12` from Keychain Access.
3. For notarization, create either:
   - **App Store Connect API key** (`.p8`) — recommended, or
   - **App-specific password** at [appleid.apple.com](https://appleid.apple.com)

## Release build

```bash
cp .env.signing.example .env.signing
# edit .env.signing with your cert + notarization credentials

pnpm build:mac:release
```

Output: `dist/fuzzy-<version>.dmg` — upload this to the Fuzzy website.

Verify on your Mac:

```bash
spctl -a -vv -t install dist/fuzzy-*.dmg
```

## Local unsigned build (dev only)

```bash
pnpm build:mac
```

Expect Gatekeeper warnings if you share this DMG. Do not ship it to users.

## Honest status

Release tooling is configured. You still need Humyn LLC's **Developer ID Application** certificate and notarization credentials in `.env.signing` before the first distributable build succeeds.
