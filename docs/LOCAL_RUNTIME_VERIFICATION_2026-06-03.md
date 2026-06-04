# Local Runtime Verification — 2026-06-03

**Branch:** `feat/ide-polish-runtime-verification`  
**Pass:** IDE polish + Phase 1 features implemented in this session.

## Automated commands

| Command | Result | Notes |
|---|---|---|
| `pnpm install` | PASS (expected) | Adds `@playwright/test` for e2e |
| `pnpm exec eslint --cache .` | RUN LOCALLY | Not completed in agent shell (timeouts) |
| `pnpm typecheck` | RUN LOCALLY | Started; verify on your machine |
| `pnpm test` | RUN LOCALLY | 9 unit test files from prior passes |
| `pnpm build` | RUN LOCALLY | Required before `pnpm test:e2e` |
| `pnpm dev` | MANUAL | Confirm Electron window opens |

## `pnpm dev` checklist

- [ ] Window opens to empty state or restored document
- [ ] No `isPackaged` TypeError in terminal
- [ ] DevTools console free of red errors on idle

## Manual smoke (22 items)

Run on a real Mac with `pnpm dev`. Record PASS / FAIL / NOT TESTED.

| # | Test | Result |
|---|---|---|
| 1 | App launches | NOT TESTED (agent) |
| 2 | PDF imports | NOT TESTED |
| 3 | Duplicate import dedupes | NOT TESTED |
| 4 | PDF renders | NOT TESTED |
| 5 | All pages index on import | NOT TESTED |
| 6 | Text selectable | NOT TESTED |
| 7 | Floating AI menu | NOT TESTED |
| 8 | Explain (mock) | NOT TESTED |
| 9 | Explain (OpenAI) | NOT TESTED |
| 10 | Save margin note | NOT TESTED |
| 11 | Margin overlay | NOT TESTED |
| 12 | Reading plan | NOT TESTED |
| 13 | Session timer | NOT TESTED |
| 14 | Study pack | NOT TESTED |
| 15 | Relaunch restores doc | NOT TESTED |
| 16 | Notes persist | NOT TESTED |
| 17 | Plan persists | NOT TESTED |
| 18 | Pack persists | NOT TESTED |
| 19 | Delete removes PDF file | NOT TESTED |
| 20 | Invalid key friendly error | NOT TESTED |
| 21 | Scanned PDF graceful (no OCR) | NOT TESTED |
| 22 | 100+ page responsive | NOT TESTED |

## Phase 1 features added this pass

- Global shortcuts: ⌘O, ⌘K, ⌘,, Escape, ⌘⇧P, ⌘⇧S
- Command palette
- Note navigation + passage flash
- Selection menu dismiss on scroll/zoom/page change
- Tutor v2: copy, regenerate, follow-up, loading skeleton, provider banner (streaming deferred)
- Sample PDF + Try sample document
- Onboarding coachmarks
- Semantic color tokens + motion
- E2E smoke (`pnpm test:e2e`)
- Packaging doc + `com.fuzzy.study` app id

## Blockers fixed in this pass

None verified in agent environment (no GUI). Prior stabilization fixes remain in tree.
