# Firebase Cloud Functions (FCM)

This folder sends **Firebase Cloud Messaging** notifications to browsers that registered a token (stored in Sanity on `userProfile.fcm_web_tokens`).

## One-time setup

1. Install [Firebase CLI](https://firebase.google.com/docs/cli): `npm i -g firebase-tools`
2. `firebase login`
3. Copy `.firebaserc.example` to `.firebaserc` and set your Firebase **project id**.
4. `cd functions && npm install`

## Environment variables

In **Google Cloud Console** → Cloud Functions → `sendPushToUser` → **Edit** → **Runtime, build…** → **Environment variables**:

| Name | Purpose |
|------|---------|
| `SANITY_PROJECT_ID` | Same as `VITE_SANITY_PROJECT_ID` |
| `SANITY_DATASET` | e.g. `production` |
| `SANITY_API_TOKEN` | Sanity token with read/write on `userProfile` (to prune dead tokens) |
| `PUSH_WEBHOOK_SECRET` | Long random string; callers must send `Authorization: Bearer <secret>` |

## Deploy

From the **repository root**:

```bash
firebase deploy --only functions
```

Copy the HTTPS URL for `sendPushToUser` (e.g. `https://us-central1-PROJECT.cloudfunctions.net/sendPushToUser`).

## Call the function

Server-to-server only (never put `PUSH_WEBHOOK_SECRET` in the browser):

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

Wire this URL from **Sanity webhooks**, **n8n**, or a small scheduled job when something important happens.

## Client (this app)

- Set `VITE_FIREBASE_VAPID_KEY` in `.env` (Firebase Console → Project settings → Cloud Messaging → **Web push certificates**).
- Run `npm run dev` or `npm run build` so Vite generates `public/firebase-messaging-sw.js`.
- Users enable notifications in **Settings**; tokens sync to their Sanity profile automatically.
