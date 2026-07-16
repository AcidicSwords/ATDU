# ATDU PWA

ATDU is a local-first Progressive Web App for binding a finite set of binary Wagers, resolving one Day at a time, and retaining the exact result in an append-only Ledger.

## Product surfaces

The operational flow has four primary surfaces:

- **Wagers** defines, revises, retires, and restores bounded Wagers.
- **Today** reconciles the currently bound Day. A person resolves `You decide` entries; `Coin decided` entries arrive fixed. Either may be recorded Null when unavailable.
- **Coin** reviews Tomorrow's availability and commits the next Day through one deliberate gesture. The result is generated and persisted before its staged reveal.
- **Ledger** shows immutable history, newest Day first.

**Rules** is a secondary utility containing the exact distributions, memory mechanism, constructor grammar, Null behavior, and convergence simulation.

## Canonical data model

One versioned `AppStateV3` is authoritative in local storage. It contains the current Wager definitions, bound Day, append-only Ledger, Tomorrow availability declarations, and any pending reveal receipt.

A Wager stores only:

```text
code · scope · constructor · variables · revision · retired
```

Its two complete Side readings are derived from the constructor and shared variables wherever they are displayed. Active Days and Ledger records retain immutable definition snapshots, so later revisions or retirement never rewrite history.

The four constructors are:

- `DO X / DO NOT DO X`
- `X THROUGH Y / X THROUGH Z`
- `X AT MOST Y / X AT LEAST Y`
- `X BEFORE Y / X AFTER Y`

Validation normalizes whitespace and Unicode, enforces bounded lengths and unique codes, requires every constructor variable, rejects identical Route terms, and verifies every hydrated or migrated boundary. Formal validity is enforced; the meaning of authored terms remains the user's responsibility.

Existing `atdu2-*` data migrates without rewriting the old keys. Canonical definitions are converted directly. Losslessly parseable legacy Side pairs are rebound to the grammar. Unparseable active definitions remain read-only historical snapshots and must be rebound or retired before another Coin event.

## Commitment and recovery

At the nightly boundary, ATDU validates and writes the reconciled Day, generated Tomorrow, definition snapshots, upcoming availability, and reveal receipt as one state transition. Only then does theatrical revelation begin. Refreshing during revelation returns to the already-fixed Tomorrow Ticket; it never rerolls.

Null before Coin consumes no toss and creates a Null entry for Tomorrow. Null during Today handles availability that changed after commitment. Neither changes Side memory.

## Run and verify

```bash
npm install
npm run dev
```

For a full production check:

```bash
npm run check
```

This runs ESLint, the unit and contract suite, and the production PWA build. Browser interaction coverage is available through `npm run test:e2e`.

Use `npm run dev:host` or `npm run preview:host` to expose the app to another device on the same network.

## GitHub Pages

The workflow at `.github/workflows/pages.yml` builds `dist/` and deploys it when explicitly run by the repository's configured trigger. Set `VITE_BASE_PATH=/` for a custom domain or `/ATDU/` for repository Pages.

## Local data

- State is stored in the current browser profile and device.
- Clearing site data resets that local state.
- If persistent storage is unavailable, the app falls back to memory for the current session.
