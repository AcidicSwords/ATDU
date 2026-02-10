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

## Deploy to GitHub Pages

1. In GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Push to `main`.
3. The workflow at `.github/workflows/pages.yml` builds the app and deploys `dist/` to Pages.

### Base path notes (Vite)

- This repo defaults to `base: "/ATDU/"` for repository Pages URLs (`https://<user>.github.io/ATDU/`).
- If you use a custom domain, set `VITE_BASE_PATH=/` in your workflow/environment before build.

## Install on iOS

1. Open the live Pages URL in **Safari**.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Launch ATDU from your Home Screen.

## Data behavior

- Data is stored in browser storage on that device/profile.
- Clearing site data resets wagers and ledger for that device.
- If persistent local storage is unavailable, ATDU falls back to in-memory storage for the current session.
