# Deploy to GitHub Pages

## 1. Add repository secrets

In your repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets (from your `.env` file):

| Secret name | Value |
|-------------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |

## 2. Enable GitHub Pages

1. Go to **Settings** → **Pages**
2. Under **Build and deployment** → **Source**, select **GitHub Actions**

## 3. Deploy

Every push to `main` will trigger a deploy. After the workflow completes:

- **Live URL:** `https://blsthathsara20.github.io/smart-vehicle-inventory/`

## 4. First-time setup

If this is a new repo, the first push may need you to enable Pages. After the workflow runs once, check **Settings** → **Pages** for the URL.
