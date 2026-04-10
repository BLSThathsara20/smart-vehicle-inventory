# Vehicle Inventory Management

A mobile-first vehicle inventory app: **React**, **Firebase Auth**, **Sanity** (data), **ImgBB** (images), **Tailwind CSS**.

## Features

- Vehicle inventory with dealer-oriented fields, reservation workflow, customer pickup links
- **Firebase** – email/password sign-in and registration; password reset via email
- **Sanity** – vehicles, roles, permissions, user profiles, workflow updates (first load seeds roles/permissions)
- **ImgBB** – vehicle photos stored as URLs on each vehicle document
- Search, filters, notifications, export (PDF/Excel), mobile-first UI

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and set:

- **Firebase** – Web app config from Firebase Console. Under **Authentication → Sign-in method**, enable **Google** and **Email/Password**. Add your domains under **Authorized domains** (e.g. `localhost`, production host).
- **Sanity** – Project ID, dataset (e.g. `production`), API version, and a token with **Editor** access (needed for browser writes)
- **ImgBB** – API key from [ImgBB API](https://api.imgbb.com/)

> Putting `VITE_SANITY_TOKEN` in the client exposes write access in the bundle. For production, prefer a backend or Sanity Actions; this matches a frontend-only setup.

### 3. Run

```bash
npm run dev
```

The first registered user gets the **super_admin** Sanity role (subsequent users default to **mechanic**).

## Legacy Supabase

The `supabase/` SQL files are **not** used by this frontend anymore. Keep them only if you still need a reference or one-off data migration into Sanity.
