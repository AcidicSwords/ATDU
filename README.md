# ATDU PWA (mobile-first)

This is a Progressive Web App built with React + Vite.
It works offline after the first load and stores data locally on your device.

## Mobile-only deployment (recommended: GitHub Pages + Actions)

### 1) Create a GitHub repo (Safari on iPhone)
- Go to GitHub → **New repository**
- Name: `atdu` (or anything)
- Public
- Create repository

### 2) Upload this project
GitHub does **not** unzip uploads automatically, so do this on iOS:

- Download **atdu-pwa.zip** to the Files app
- Tap it to **unzip**
- Open the folder → select **all files/folders inside** (index.html, src/, public/, package.json, etc.)
- In Safari on GitHub: **Add file → Upload files**
- Upload the selected items
- Commit to `main`

(If selecting many files in iOS Safari is annoying, use the iOS app **Working Copy** instead; it makes this painless.)

### 3) Turn on GitHub Pages (Actions)
- Repo → **Settings → Pages**
- Source: **GitHub Actions**

Pushes to `main` will now build + deploy.

### 4) Install on iOS as an “app”
- Open your deployed URL in Safari
- Share → **Add to Home Screen**
- Launch ATDU from the Home Screen (standalone)

## Local use (no hosting)
iOS Safari will not let a plain `file://` webpage act like a real offline PWA.
If you want “local only”, you still need *some* localhost/server environment.
Easiest practical path on iOS is: deploy to GitHub Pages once, then install to Home Screen.

## Data
All wagers + ledger are stored in your browser storage on that device.
If you clear Safari website data, it will reset.
