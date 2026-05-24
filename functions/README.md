# Firebase Cloud Functions

This folder contains HTTP functions used by the vehicle app.

## Setup (shared)

1. Install [Firebase CLI](https://firebase.google.com/docs/cli): `npm i -g firebase-tools`
2. `firebase login`
3. Copy `.firebaserc.example` to `.firebaserc` and set your Firebase **project id**.
4. `cd functions && npm install`

## Deploy (all functions)

From the **repository root**:

```bash
firebase deploy --only functions
```

---

## `submitPublicViewingBooking` — public viewing requests

Customer **Book a viewing** (`/book/vehicle/:id`) sends **`POST`** JSON here; the handler appends a row to Sanity `vehicle.viewing_bookings` (same as staff-created viewings → **Viewings** page + vehicle viewings modal).

> Prefer no backend at all? Set **`VITE_PUBLIC_BOOKING_EMAIL`** on the SPA — customers send a prefilled email instead (**root `README`**). Requests are **not** added to Sanity until staff enter them.

Writes use the **Sanity token on the server** — customers never get Editor tokens.

### Environment variables

Set in Firebase / Google Cloud for this function:

| Name | Purpose |
|------|---------|
| `SANITY_PROJECT_ID` | Same as `VITE_SANITY_PROJECT_ID` |
| `SANITY_DATASET` | e.g. `production` |
| `SANITY_API_TOKEN` | **Editor** (or capable of **patch** on `vehicle` documents — not Viewer-only) |
| `PUBLIC_BOOKING_ALLOWED_ORIGINS` | Optional comma-separated URL **prefixes** (e.g. `https://yourdomain.com,https://user.github.io/smart-vehicle-inventory`). If set, **`Origin`** or **`Referer`** must start with one. Leave unset for open CORS behaviour while prototyping. |
| `PUBLIC_BOOKING_TIMEZONE` | **[Luxon](https://moment.github.io/luxon/)** IANA zone for opening-hour checks (default **`Europe/London`**). Should match where your weekday/Sunday rules apply.

### Opening hours enforced server-side

- **Monday–Saturday:** half-hour slots from **10:00** through **18:30** (last slot ends by 19:00).  
- **Sunday:** slots from **12:30** through **15:00** (closes 15:30).  


The browser calendar mirrors this; spoofed ISO values outside these windows get **400** from the function.

Frontend: set **`VITE_PUBLIC_VIEWING_BOOKING_URL`** in the SPA `.env` to the deployed function URL, e.g.
`https://us-central1-PROJECT.cloudfunctions.net/submitPublicViewingBooking`.

### Security notes

- Hidden **honeypot** field `hp_company` — bots that fill it get a silent success response.
- Inputs are trimmed, length-capped, and stripped of control characters and `<` `>` tags.
- **Sold** / **reserved** vehicles are rejected.
- Appointment time must fall on allowed **Luxon weekday + half-hour slots** in `PUBLIC_BOOKING_TIMEZONE`.

For abusive traffic in production: tighten **`PUBLIC_BOOKING_ALLOWED_ORIGINS`**, add rate limiting (e.g. Cloud Armor), or **App Check**.

---

## `sendPushToUser` — FCM web push

Sends Firebase Cloud Messaging to browsers that registered a token (stored on Sanity **`userProfile.fcm_web_tokens`**).

Configure in Cloud Console → **Runtime → Environment variables**:

| Name | Purpose |
|------|---------|
| `SANITY_PROJECT_ID` | Same as `VITE_SANITY_PROJECT_ID` |
| `SANITY_DATASET` | e.g. `production` |
| `SANITY_API_TOKEN` | Token with read/write on `userProfile` (to prune dead tokens) |
| `PUSH_WEBHOOK_SECRET` | Long random string; callers send `Authorization: Bearer <secret>` |

### Call the function

**Server-side only** (never put `PUSH_WEBHOOK_SECRET` in the browser):

```bash
curl -sS -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $PUSH_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "firebase_uid": "THE_ASSIGNEE_FIREBASE_UID",
    "title": "New prep task",
    "body": "You were assigned a step on a work path.",
    "path": "/app/my-work"
  }'
```

Wire this URL from **Sanity webhooks**, **n8n**, or a scheduled job.

### Client

- **`VITE_FIREBASE_VAPID_KEY`** in `.env` (Firebase Console → Cloud Messaging → Web push certificates).
- Build/dev generates `public/firebase-messaging-sw.js`.
- Users enable notifications in **Settings**; tokens sync to their Sanity profile.
