# ATDU PWA

ATDU is a Progressive Web App built with React + Vite.
It runs the ATDU rule system locally in the browser and stores wagers + ledger data on-device.

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
npm run build
npm run preview:host
```

## Deploy (GitHub Pages)

1. Push this repo to GitHub.
2. Configure Pages to deploy from GitHub Actions.
3. Deploy the `dist/` output produced by `npm run build`.

## Install as app (mobile + desktop)

- **iOS Safari**: Share → **Add to Home Screen**.
- **Android Chrome**: browser menu → **Install app**.
- **Desktop Chrome/Edge**: use the install icon in the address bar.

## Data behavior

- Data is stored in browser storage on that device/profile.
- Clearing site data resets wagers and ledger for that device.
- If persistent local storage is unavailable, ATDU falls back to in-memory storage for the current session.
