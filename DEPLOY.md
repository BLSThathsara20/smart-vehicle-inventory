# Deploy to GitHub Pages

## 1. Firebase: authorize the GitHub Pages domain (required for sign-in)

If you see **`auth/unauthorized-domain`** or a console message that the domain is not authorized for OAuth:

1. Open [Firebase Console](https://console.firebase.google.com/) → your project  
2. **Build** → **Authentication** → **Settings** (gear) → **Authorized domains**  
3. Click **Add domain**  
4. Add: **`blsthathsara20.github.io`** (no `https://`, no path)

Also add **`localhost`** if it is not already listed (local dev).

Without this, **Google sign-in** and **email/password** flows that use the hosted auth handler will fail on the live site.

## 2. Add repository secrets

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Names must match what the app and [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) expect (see [`.env.example`](.env.example)):

| Secret name | Notes |
|-------------|--------|
| `VITE_FIREBASE_API_KEY` | Firebase web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | |
| `VITE_FIREBASE_PROJECT_ID` | |
| `VITE_FIREBASE_STORAGE_BUCKET` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | |
| `VITE_FIREBASE_APP_ID` | |
| `VITE_SANITY_PROJECT_ID` | |
| `VITE_SANITY_DATASET` | e.g. `production` |
| `VITE_SANITY_API_VERSION` | optional; defaults in app if empty |
| `VITE_SANITY_TOKEN` | Editor token (Sanity) |
| `VITE_IMGBB_API_KEY` | Image uploads |

Optional / legacy: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (not used by the current frontend gate).

## 3. Enable GitHub Pages

**Settings** → **Pages** → **Source:** **GitHub Actions**

## 4. Deploy

Push to `main` (or run **Actions** → **Deploy to GitHub Pages** → **Run workflow**).

**Live URL:** `https://blsthathsara20.github.io/smart-vehicle-inventory/`

## 5. After changing secrets

Re-run the deploy workflow so Vite rebuilds with the new `VITE_*` values (they are inlined at build time).
