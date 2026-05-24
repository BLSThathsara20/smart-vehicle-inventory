# Vehicle Inventory Management

A mobile-first vehicle inventory app: **React**, **Firebase Auth**, **Sanity** (data), **ImgBB** (images), **Tailwind CSS**.

## Features

- Vehicle inventory with dealer-oriented fields, reservation workflow (reserved → **fresh full service** → PDI → collection date → manager ready-to-pickup → handover), customer pickup links
- **Firebase** – Google sign-in and email/password; password reset via email
- **Sanity** – vehicles, roles, permissions, user profiles, workflow updates (first load seeds roles/permissions)
- **ImgBB** – vehicle photos stored as URLs on each vehicle document
- Search, filters, notifications, export (PDF/Excel), mobile-first UI
- **Workshop services** — `/app/services` schedules jobs for inventory or external customers, optional mechanic and sales assignments, overlap-aware calendar-day popover, **PDF export** of bookings **without customer contact columns**, **permanent purge** with a Sanity **`deletionAudit`** snapshot (who deleted + non‑PII fields; requires **`inventory:delete`**), and “service today” rows in **Notifications** for assignees plus manager-tier roles (`super_admin` or permissions `inventory:delete` / `users:manage`). Editing uses the same **inventory:edit** permission as vehicle/viewing workflows.
- **Public scheduled collections** — `/pullouts` lists reserved vehicles (not sold); those with a planned collection date sort first, others still appear until a date is set (no customer PII); read-only for everyone including guests, with PDF export. Signed-in staff also reach this from the sidebar **Pullouts** link (same URL).
- **Customer viewing link** — share **`/book/vehicle/:id`**: booking UI with dealership hours (**Mon–Fri 10am–7pm**, **Sun 12:30pm–3:30pm**, **Sat closed**) as half-hour slots; Cloud Function validates the same windows in **`PUBLIC_BOOKING_TIMEZONE`** (Luxon). Set **`VITE_PUBLIC_VIEWING_BOOKING_URL`** and deploy **`submitPublicViewingBooking`** (**`functions/README.md`**). Inputs sanitized (DOMPurify client + plain-text rules in the function).

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and set:

- **Firebase** – Web app config from Firebase Console. Under **Authentication → Sign-in method**, enable **Google** and **Email/Password**. Add your domains under **Authorized domains** (e.g. `localhost`, production host).
- **Sanity** – Project ID, dataset (e.g. `production`), API version, and a token with **Editor** access (needed for browser writes). Using a **Viewer** (read-only) token produces **403** and “permission ‘create’ required” when adding or editing vehicles.
- **ImgBB** – API key from [ImgBB API](https://api.imgbb.com/)

> Putting `VITE_SANITY_TOKEN` in the client exposes write access in the bundle. For production, prefer a backend or Sanity Actions; this matches a frontend-only setup.

### 3. Run

```bash
npm run dev
```

The first Firebase sign-in creates the initial **`userProfile`** with **super_admin**. Additional **Google** sign-ins **without** a profile queue a Sanity **`staffJoinRequest`** until someone with **Users** access approves them on the **Users** page (notifications surface pending requests too). **Email/password** sign-ups still get an immediate **guest** profile with **no permissions**: they use public **Browse stock** (`/find`) until an administrator assigns a role (internal **`/vehicle/:id`** and **`/app/*`** pages remain permission-guarded).

### Sanity `staffJoinRequest` (Google onboarding)

Add this document type in Studio if you want editable titles/help text (optional — the app creates documents via API):

| Field | Type | Notes |
| ----- | ---- | ----- |
| `firebase_uid` | string | Firebase Auth UID |
| `email` | string | From Google |
| `display_name` | string | Optional |
| `status` | string | `pending` or `ignored` |
| `requested_at` | datetime | First request time |

Stable `_id`: `staffJoinRequest.{sanitizedUid}` (derived from Firebase UID).

### Sanity `workshopService` (sidebar **Services**)

Add this document type in Studio so you can sanity-check fields locally (optional — the API can create/write without Studio):

| Field | Type | Notes |
| ----- | ---- | ----- |
| `is_asahi_customer` | boolean | When true, require `inventory_vehicle` reference |
| `inventory_vehicle` | reference → `vehicle` | Optional when walk-in external |
| `customer_name`, `customer_phone`, `customer_email` | strings | Booking contact |
| `vehicle_make`, `vehicle_model`, `plate` | strings | Capture details; populated from inventory when a vehicle is selected |
| `scheduled_at` | datetime | Booking start |
| `duration_minutes` | number | Defaults to 60; used for overlap detection |
| `location` | string | Where the job happens |
| `mechanic_firebase_uid`, `sales_firebase_uid` | strings | Firebase Auth UID of assignees (notifications when today) |
| `notes` | text | Instructions / comments |
| `service_price` | number | Optional job charge (used for diary-month earnings banners and analytics). |
| `status` | string | `scheduled`, `completed`, or `cancelled` |
| `completed_at` | datetime | Set when marked **Done** (status `completed`) |
| `cancelled_at` | datetime | Set when cancelled |
| `created_by_firebase_uid`, `created_by_name`, `created_at`, `updated_at` | audit | Set by app |

Stable `_id` pattern from the client: `workshopService.{uuid}`.

### Sanity `deletionAudit` (workshop purge log)

Written **before** a `workshopService` document is hard-deleted. Add in Studio optionally (the **API creates** these docs without a Studio schema).

| Field | Type | Notes |
| ----- | ---- | ----- |
| `resource_type` | string | Currently `workshopService` |
| `resource_id` | string | The deleted Sanity `_id` |
| `deleted_at` | datetime | Mutation time |
| `deleted_by_firebase_uid`, `deleted_by_email`, `deleted_by_display_name` | strings | Acting user from the signed-in profile / Firebase session |
| `snapshot` | object | **Non‑PII** copy: schedule, vehicle make/model/plate, location, assignee UIDs, inventory link, statuses, timestamps — customer name/phone/email/notes **are intentionally omitted** |

For **inventory vehicles**, deletion with audit is handled from **Vehicle detail** (`inventory:delete`). Viewing bookings and similar data are trimmed on vehicles / flows as today.


## Pre-delivery inspection (PDI)

When a vehicle is **reserved**, the app stores a checklist on the Sanity `vehicle` document in a **text field** named `pdi_inspection_json` (JSON blob managed entirely from this app).

1. Add the field to your **Sanity Studio** `vehicle` schema (type **`text`** is enough; alternatively use Sanity’s **`json`** type if you prefer Studio editing):

   ```ts
   defineField({
     name: 'pdi_inspection_json',
     title: 'PDI checklist (JSON — app-managed)',
     type: 'text',
     rows: 6,
     readOnly: true,
   }),
   ```

2. Reservations created from **Reserve vehicle** or from **Vehicle form** → **Reserved** automatically seed headers (plate, VIN, mileage, buyer name, vehicle make/model) into that JSON.

3. On the **Pulout / collection** page (`/app/collection/:vehicleId`), expand **Pre-Delivery Inspection (PDI)** to record inspection items and tyre tread per corner, enter damages / MD approval line, **Save draft**, optionally **Export PDI PDF** for stamping, then **Complete PDI** to mark checklist finalized and sync the reservation workflow “Pre-delivery inspection” step (if not already recorded). From the vehicle page, use **Open collection page** to reach this flow.

Optional env: **`VITE_PDI_BRAND_LINE`** — overrides the PDF header branding (see `.env.example`).

### Customer pickup link — important notice (Sanity)

Optional **`pickup_important_notice`** (`text`) on the **`vehicle`** document. When it has content, the customer reservation/pickup page (`/pickup/:token`) shows a highlighted alert near the top. Staff can edit it from the vehicle form when status is **Reserved**; it is cleared when status is no longer reserved or when the reservation is cancelled via the app’s pickup-token flow.

**`agreed_deal_price`** (number, optional) — final negotiated amount when reserving or handing over a sale. Inventory **Analytics** prefers this figure over **`selling_price`** for monthly sale-revenue totals when it is present. Capture it when **Reserve vehicle** opens or edit it on the vehicle form (**Reserved** / **Sold**). Add the field to your **`vehicle`** schema in Sanity Studio alongside **`selling_price`**.

Add to Studio:

```ts
defineField({
  name: 'pickup_important_notice',
  title: 'Pickup page — important notice',
  type: 'text',
  rows: 4,
}),
```

Customers can optionally confirm attendance on their **planned collection date** via the `/pickup/:token` page (writes **`customer_collection_confirmed_at`**; same plate/stock gate as cancelling when those apply). Staff see this on **Reservation workflow** beside **Delivery scheduled**, and under vehicle details:

```ts
defineField({
  name: 'customer_collection_confirmed_at',
  title: 'Customer acknowledged collection date (pickup link)',
  type: 'datetime',
}),
```

Prep **work paths** (sidebar *Work paths*) remain separate from PDI; only one ops work path can be attached per vehicle today. If the vehicle has a **planned collection date**, the app requires a prep-path **deadline on or before** that day (and not in the past) when applying the path — enforced in the UI and in Sanity writes.

### Prep work path template in Sanity

Operational templates are Sanity **`workPath`** documents (name, optional `description`, `apply_when`, `allow_step_overlap`, **`steps`** with **`role`** and **`assignee`** references to `role` / `userProfile`). Add this type to Studio if templates cannot be saved.

With an **Editor** API token and after **someone signs in once** (`userProfile` exists), the app automatically creates **`workpath-standard-prep`** — **Standard pre-delivery prep** (`reserved_only`) — so **Work paths** and the vehicle “Apply prep path” dropdown typically show at least one template. Rename, edit assignees/steps, or delete it freely. This is complementary to reserved-vehicle **PDI** checklist storage (`pdi_inspection_json`).

## Car key location (Sanity)

The add/edit vehicle form saves **`car_key_location`** (integer, optional) under **1. Core Identification** — for example key cupboard or hook number. Add to your Sanity **`vehicle`** schema:

```ts
defineField({
  name: 'car_key_location',
  title: 'Car key location',
  type: 'number',
}),
```

Without this field, Studio may reject patches or the value will not persist.

## Legacy Supabase

The `supabase/` SQL files are **not** used by this frontend anymore. Keep them only if you still need a reference or one-off data migration into Sanity.
