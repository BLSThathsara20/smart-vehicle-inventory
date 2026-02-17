# Vehicle Inventory Management

A mobile-first vehicle inventory management system for car sales, built with React, Supabase, and Tailwind CSS.

## Features

- **Vehicle inventory** – Stock ID, plate number, brand, model, body, details, color, mileage, CC, model year, fuel type, gear, features (JSON), sold/reserved status
- **Images** – 1–4 images per vehicle, compressed before upload
- **Super admin** – First-time registration (one-time only), then login
- **Search** – By stock ID, plate, brand, model, location
- **Mobile-first** – Responsive design with sticky bottom navigation
- **Orange theme** – Consistent branding
- **Notifications** – Toast notifications for actions

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

- `VITE_SUPABASE_URL` – Project URL from Supabase Dashboard > Project Settings > API
- `VITE_SUPABASE_ANON_KEY` – Publishable/anon key from the same page
- `SUPABASE_DB_PASSWORD` – Database password (for reference; not used by the frontend client)

### 3. Supabase setup

1. **Database schema** – Run `supabase-schema.sql` in Supabase SQL Editor (Dashboard > SQL Editor).

2. **Migration (if you already have tables)** – Run `supabase/migrations/001_super_admin_first_time_registration.sql` to add the admins table and RLS for first-time super admin registration.

3. **Storage bucket** – If the schema doesn’t create it, create a bucket manually:
   - Dashboard > Storage > New bucket
   - Name: `vehicle-images`
   - Public: Yes

4. **Auth** – On first visit, the app shows **Super Admin Registration**. Register once; after that only the login form is shown. No need to create users in the dashboard.

### 4. Run the app

```bash
npm run dev
```

## Project structure

```
src/
├── components/     # Reusable UI components
├── context/        # Auth & Notification context
├── lib/            # Supabase client, image compression
├── pages/          # Route pages
└── App.jsx
```

## Deploy to GitHub Pages

See [DEPLOY.md](./DEPLOY.md) for step-by-step instructions. After setup, the app will be live at:

`https://blsthathsara20.github.io/smart-vehicle-inventory/`

## Tech stack

- React 19 + Vite
- Supabase (Auth, Database, Storage)
- React Router
- Tailwind CSS
- Lucide React (icons)
- browser-image-compression
