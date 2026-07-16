# ATDU PWA

ATDU is a Progressive Web App built with React + Vite.
It runs the ATDU rule system locally in the browser and stores wagers + ledger data on-device.

## Interaction model

ATDU has four persistent views: **Wager**, **Coin**, **Ledger**, and **Rule**. Placing or revising a Wager is a focused subflow within Wager. An upward Coin flick opens one modal mechanical sequence and returns to Coin for reconciliation; each phase can be advanced and the full sequence can be revealed immediately.

The forward-facing Wager constructors are:

- `DO X / DO NOT DO X`
- `X THROUGH Y / X THROUGH Z`
- `X AT MOST Y / X AT LEAST Y`
- `X BEFORE Y / X AFTER Y`

The interface supplies this grammar; the user supplies only its variables.

Wager validity is formal. The model normalizes authored whitespace and Unicode,
enforces code uniqueness and shared length limits, requires every constructor
variable, derives both Sides from the selected grammar, and rejects identical
Route terms. It does not judge the content semantically or morally. Stored
Wagers, active Days, and Ledger Days are sanitized again at hydration and write
boundaries so presentation state cannot become canonical data by accident.

## Object and lifecycle model

- A current Wager owns an immutable code, bounded situation, constructor, two defined Sides, revision, and active/retired status.
- The Coin externalizes the fair environmental condition and, when Constrained, acts as agent through declared memory and involution.
- A Day binds a definition snapshot and one generated condition to every Wager in that Day. Revising or retiring a Wager does not rewrite that bound Day.
- Once the current Day is reconciled, upcoming availability is declared separately. A Wager set Null before Flip consumes no Coin toss and enters the next Day fixed as Null; a Wager that becomes unavailable after Flip can still be reconciled Null for that Day.
- The Ledger is append-only. Each entry stores only Null or the compact system state; its definition snapshot preserves what A and B meant for that revision.
- While a Day is bound, additions, revisions, restorations, and retirements queue for the next Flip boundary. Formal A/B memory persists by code; authored wording propagates only to future Day snapshots.

## Run locally

```bash
npm install
npm run dev
```

## Access from phone and computer on the same network

Use Vite host mode so other devices can reach your machine:

```bash
npm run dev:host
```

Then open the printed LAN URL on your phone (same Wi-Fi).

## Production build

```bash
npm run lint
npm test
npm run build
npm run preview:host
```

`npm run check` runs static analysis, the complete test suite, and the production build.

## Deploy to GitHub Pages

1. In GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. In **Settings → Pages → Custom domain**, set your domain to `atdu.app` (or another ATDU domain you own).
3. Create the Actions repository variable `VITE_BASE_PATH` with the value `/`.
4. Push to `main`.
5. The workflow at `.github/workflows/pages.yml` builds the app and deploys `dist/` to Pages.

### Base path notes (Vite)

- Use `base: "/"` for custom-domain URLs like `https://atdu.app/` (no username in the URL).
- If you deploy to repository Pages instead, set `VITE_BASE_PATH=/ATDU/` before build.
- If the Actions variable is omitted, the workflow defaults to `/ATDU/`.

## Install on iOS

1. Open the live Pages URL in **Safari**.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Launch ATDU from your Home Screen.

## Data behavior

- Data is stored in browser storage on that device/profile.
- Clearing site data resets wagers and ledger for that device.
- If persistent local storage is unavailable, ATDU falls back to in-memory storage for the current session.
