# GeoClean — Technical Approach

## Scope and evidence note

This document is based only on the current React source, `package.json`, and the two Supabase SQL migration files in this repository. It describes the intended Supabase schema and policies defined by those migrations; it does **not** prove that the SQL has already been applied to a remote Supabase project. Items marked **Not found in current codebase** are deliberately not assumed.

## 1. Project overview

GeoClean is a waste-issue reporting and cleanup-coordination web application. A citizen can create a report with a waste category, optional description, optional photograph, and optional browser-detected coordinates. The report is stored in Supabase. NGOs that have saved coordinates can view reports that fall within the implemented 25 km service radius, claim one safely, record progress, upload an after-cleaning photo, and resolve it. Citizens can view the current status of reports they created.

The implemented user roles are:

- **Citizen (`user`)** — registers, signs in, creates waste reports, and reads their own report history.
- **NGO (`ngo`)** — registers an organisation profile, maintains its service coordinates, views eligible reports, accepts/releases work, updates work progress, and uploads completion proof.
- **Admin (`admin`)** — the route and role exist, but the current dashboard is a UI prototype driven by browser local storage/demo values rather than implemented Supabase administration.

Implemented core flow:

```text
Citizen → Supabase sign-in → React report form
        → waste_reports + optional report-images Storage upload
        → nearby NGO notification record (when report coordinates exist)
        → NGO views nearby report → atomic RPC claim
        → assigned → in progress → after photo → resolved
        → Citizen reads updated status in My Reports
```

## 2. Technology stack

| Area | Actual technology | Role in GeoClean |
|---|---|---|
| Frontend | React 18 | Builds the interactive single-page user interface. |
| Language | TypeScript | Adds type checking to the React code. |
| Build tool | Vite 5 | Runs local development and produces the production frontend bundle. |
| Routing | React Router DOM 7 | Routes users to citizen, NGO, admin, and shared pages and protects role-specific pages. |
| Styling | Tailwind CSS 3 plus `src/index.css` | Provides utility styling and project-specific responsive CSS. |
| Icons | Lucide React | Supplies the UI icons. |
| Backend platform | Supabase via `@supabase/supabase-js` | The frontend communicates directly with authentication, database, Storage, and PostgreSQL RPC functions. |
| Database | Supabase PostgreSQL | Stores profiles, NGOs, reports, images, assignments, and notification records. |
| Authentication | Supabase Auth | Manages email/password accounts, sessions, password-reset emails, and `auth.users`. |
| Object storage | Supabase Storage | Stores report photographs in the private `report-images` bucket. |
| Server-side workflow logic | PostgreSQL functions/triggers in Supabase migrations | Creates profile records, calculates eligibility, creates notifications, and performs guarded report state changes. |

There is **no custom Express/Node backend server**, Firebase, MongoDB, Axios, or project-defined REST API found in the codebase. Vite/Node are development/build tooling, not an application server.

## 3. System architecture

```text
Browser user
    ↓
React + TypeScript SPA (Vite)
    ↓  Supabase JavaScript client
    ├── Supabase Auth: accounts, sessions, password reset
    ├── PostgreSQL: profiles, NGOs, reports, assignments, notifications
    │      └── PL/pgSQL triggers + RPC functions + RLS policies
    └── Private Storage bucket: report-images
             ↓
Citizen reporting and tracking / NGO nearby-cleanup workflow
```

- **Frontend layer:** React components render the forms, dashboards, route guards, and responsive screens. `ProtectedRoute` redirects unauthenticated users and redirects a signed-in user away from a route not matching their loaded profile role.
- **Service layer:** The browser uses the Supabase client with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable key is appropriate for a browser client; no service-role key is present in source.
- **Database layer:** PostgreSQL tables and database functions define report ownership, NGO assignment, notifications, and status transitions.
- **Authentication layer:** Supabase Auth establishes identity; the application then loads the corresponding `profiles` row to determine the application role.
- **Storage layer:** Before/after files are uploaded to the private `report-images` bucket. The app creates signed URLs and stores them in `report_images.image_url` for display.

## 4. Database design

### Main relationships

```text
auth.users (Supabase Auth account)
        1 ── 1 profiles
                  └── 0..1 ngos (only for NGO role)

profiles (citizen) 1 ── many waste_reports
waste_reports      1 ── many report_images
waste_reports      1 ── many ngo_assignments
ngos               1 ── many ngo_assignments / assigned reports
profiles           1 ── many notifications
```

### Tables defined in the migrations

| Table | Purpose and important fields | Relationships and constraints |
|---|---|---|
| `profiles` | Application profile: `id`, `full_name`, `email`, `mobile_number`, `role`, `created_at`. | `id` is both the primary key and FK to `auth.users(id)` with cascade delete. `role` is checked to `user`, `ngo`, or `admin`. |
| `ngos` | NGO organisation/service-area record: `id`, `profile_id`, name, address, optional latitude/longitude, contact and public profile fields. | UUID primary key; `profile_id` is a unique FK to `profiles`, so one profile has at most one NGO row. |
| `waste_reports` | Core issue: UUID `id`, unique generated `report_code`, citizen `user_id`, title/type/description/address, optional coordinates, status, assigned/resolved NGO IDs, timestamps. | `user_id` FK to `profiles`; `assigned_ngo_id` and `resolved_by` FKs to `ngos`. Status is checked to `submitted`, `available`, `assigned`, `in_progress`, `resolved`, or `released`. |
| `report_images` | Metadata for a report's before/after photo: URL, type, uploader, timestamp. | FKs to report and profile. Unique `(report_id, image_type)` allows only one before and one after image per report. |
| `ngo_assignments` | Assignment history for an NGO/report pair, including accepted/released state, timestamps, and release reason. | FKs to report and NGO. Unique `(report_id, ngo_id)` prevents duplicate history records for the same pair. |
| `notifications` | Per-user notification records with title, message, read flag, optional report reference, and timestamp. | `user_id` FK to profile; report FK cascades if a report is deleted. |

Two important triggers are defined:

1. `on_auth_user_created` calls `handle_new_user()`. It creates a profile when a Supabase Auth account is created, and also creates an NGO record when the supplied role metadata is `ngo`.
2. `set_report_fields` generates a `GC-YYYY-XXXXXX` report code when absent and refreshes `updated_at`. A separate `notify_nearby_ngos` trigger inserts notification records for NGOs within 25 km when a geo-located report is inserted.

## 5. Authentication and authorization

**Authentication answers “Who is the user?”** GeoClean uses Supabase Auth email/password calls: `signUp`, `signInWithPassword`, `getSession`, `getUser`, `onAuthStateChange`, `signOut`, and `resetPasswordForEmail`. A session is restored on app start, then the matching `profiles` record is loaded.

**Authorization answers “What may this user do?”** The profile role is used in React route guards and in the database rules/functions.

- During registration, citizens and NGOs provide role metadata to Supabase Auth. NGO registration additionally collects organisation name, official email, contact person, phone, and location; latitude and longitude are optional inputs.
- On login the application signs in first, loads the profile, and checks that its stored role matches the selected role. It signs out and shows an error if it does not match.
- An NGO login also requires a matching `ngos` row. This prevents an Auth account with an NGO role but no organisation profile from entering the NGO workflow.
- Self-service admin registration is blocked in the UI. No migration or code that provisions/validates admins was found.

## 6. Row Level Security (RLS)

The NGO workflow migration enables RLS on all six public tables. These are the policies actually defined:

| Data | Actual access rule |
|---|---|
| `profiles` | Any authenticated user may read profiles; only the owner (`id = auth.uid()`) may update their own profile. |
| `ngos` | Any authenticated user may read NGO profiles; an NGO profile can only be updated when its `profile_id = auth.uid()`. |
| `waste_reports` | An authenticated citizen may insert only when `user_id = auth.uid()`. Reads are allowed for the reporting citizen, the assigned NGO, or an NGO for which `is_nearby_report()` returns true. |
| `report_images` | A report owner, assigned NGO, or eligible nearby NGO may read image metadata. A citizen may add only their own `before` metadata; an assigned NGO may add only its `after` metadata. |
| `ngo_assignments` | An NGO can read only assignments where `ngo_id` is its current NGO record. |
| `notifications` | A user can read/update only their own notification rows. |
| Storage objects | Authenticated users can read objects in `report-images`; uploads are allowed only into a folder whose first segment matches `auth.uid()`. |

Important prototype limitations to explain honestly:

- The policies do **not** define a special admin database access path. An `admin` role exists in the profile constraint/UI but is not granted broad RLS privileges by these migrations.
- Any authenticated user can read all profile and NGO records because both SELECT policies use `true`.
- The storage read policy permits every authenticated user to read any object in the private bucket. It is authenticated, but it is not restricted to the related report's owner/eligible NGO.
- There is no RLS DELETE policy for the main tables. The citizen-side “Delete” UI only removes a local-storage item and hides the in-memory card; it does not delete the Supabase report.
- Direct report updates have no client-exposed RLS update policy. Normal NGO state changes correctly go through the guarded RPC functions instead.

## 7. Citizen reporting workflow

The citizen report modal is a five-step React form: issue type, photo, location, description, and review.

```text
Citizen
  → selects waste type (required)
  → optionally selects image
  → optionally grants browser location permission
  → adds optional description
  → React inserts into waste_reports
  → optional file upload to report-images
  → report_images row with image_type = before
  → My Reports queries the user's reports and displays status
```

The insert sends `user_id`, `title`, `waste_type`, `description`, `address`, `latitude`, and `longitude`. The address is currently the UI string `Detected location near <lat>, <lng>` when location is acquired; there is no address lookup/geocoding API. If location is skipped/denied, latitude and longitude are stored as `null` and the displayed address remains `Location not added yet`.

The report form requires a waste category, but photo, location, and description are optional in the implementation. The database default makes a new report `available` (not `submitted`). My Reports filters by the authenticated user's `user_id`, orders by `created_at` descending, and shows the current status and before image.

## 8. NGO workflow

1. An NGO registers through Supabase Auth. The auth trigger creates its profile and linked NGO record.
2. The NGO signs in and must pass both the profile-role check and NGO-record check.
3. It can edit its profile and save its service latitude/longitude using browser geolocation in the NGO profile page.
4. The NGO dashboard loads `waste_reports`; RLS filters results to reports owned by that NGO, assigned to it, or geographically eligible.
5. The database's `is_nearby_report()` uses a spherical-distance calculation and treats a report as nearby only when both report and NGO have coordinates and their distance is **25 km or less**.
6. For an available/released eligible report, the NGO calls `accept_nearby_report`.
7. The assigned NGO can move the report from `assigned` to `in_progress`, upload one after-cleaning image, then resolve it. Resolution is denied by the database function until an `after` image exists.
8. It may release an assigned/in-progress report with a required UI reason; its assignment history is marked released, and that NGO cannot claim the same report again.

No map provider, map API, reverse-geocoding service, route planning, or municipality dispatch integration is implemented.

## 9. Geolocation

The project uses the browser’s `navigator.geolocation.getCurrentPosition`, not a map/geocoding SDK.

- **Citizen report:** uses high accuracy and a 10-second timeout. Coordinates are rounded to five decimal places in the UI and inserted into `waste_reports.latitude`/`longitude`.
- **NGO service area:** the NGO profile uses high accuracy, a 15-second timeout, no cached location (`maximumAge: 0`), then writes coordinates to `ngos.latitude`/`longitude` after the NGO presses Save Location.
- **Matching:** `is_nearby_report()` performs the 25 km calculation inside PostgreSQL. Missing coordinates make a report ineligible for nearby-visibility matching.
- **Errors:** both flows present user messages for unsupported browsers, denied permission, unavailable position, and timeout. A citizen may still submit without location; an NGO dashboard explicitly asks the NGO to save coordinates before it can see nearby requests.

## 10. Image/photo handling

Supabase Storage is implemented.

- The private bucket is named `report-images`.
- Before images are uploaded to `<auth-user-id>/before/<report-id>-<timestamp>-<sanitized-filename>`.
- After images are uploaded to `<auth-user-id>/after/<report-id>-<timestamp>-<sanitized-filename>`.
- After each upload, the frontend creates a signed URL with a one-year expiry and stores that URL in `report_images.image_url`, alongside `before` or `after` and the uploader profile ID.
- Images are displayed in citizen report detail, NGO report detail, NGO dashboard cards, and the NGO impact page.

The UI advertises PNG/JPG up to 10 MB, but the client code itself does not enforce a file size or MIME-type validation beyond the file picker’s `accept="image/*"`. There is no image-processing or AI image service found.

## 11. Report claiming and status management

Claiming uses an actual Supabase PostgreSQL RPC, not a simple client-side direct update:

```text
available or released
  → accept_nearby_report() → assigned
  → update_assigned_report_status('in_progress') → in_progress
  → after photo must exist
  → update_assigned_report_status('resolved') → resolved

assigned / in_progress
  → release_assigned_report(reason) → released
```

`accept_nearby_report()` reads the NGO identity from the signed-in user, locks the report row with `FOR UPDATE`, verifies geographical eligibility, verifies that the report is unassigned and `available`/`released`, then assigns it and writes the assignment history in one database operation. This is the important concurrency protection: when two NGOs attempt to claim the same report, the lock means the first valid transaction wins and the other sees that it has already been assigned.

The status function also ensures only the currently assigned NGO can progress the work. It permits only `assigned → in_progress` and `in_progress → resolved`; the latter requires an after-cleaning image.

## 12. API/data communication

The React application talks to Supabase through the Supabase JavaScript client. There is no custom Express API layer in the repository.

- **Auth:** sign-up, password sign-in, current-user/session retrieval, auth-state listener, sign-out, and password-reset email.
- **Table queries:** `profiles`, `ngos`, `waste_reports`, `report_images`, `ngo_assignments`, and `notifications` are queried/updated with `.from(...).select/insert/update`.
- **RPC:** `.rpc('accept_nearby_report')`, `.rpc('release_assigned_report')`, and `.rpc('update_assigned_report_status')` call PostgreSQL workflow functions.
- **Storage:** `.storage.from('report-images').upload()` and `.createSignedUrl()` manage images.

One unrelated diagnostic call queries a `todos` table on app mount. No `todos` table or migration is present, and the result is ignored; it is not part of the GeoClean workflow.

## 13. Validation and error handling

Implemented validation/error handling includes:

- Citizen: required issue type; sign-in check before insert; database/upload/image-metadata errors shown in the report modal.
- NGO sign-up: required organisation name, official-email format, contact person, 10–15 digit phone pattern, location, password confirmation, and a six-character minimum password.
- Citizen sign-up: name, email format, password confirmation, and password length checks.
- Auth: friendly messages for invalid credentials, missing profile/NGO record, wrong selected role, already signed-in registration, duplicate account detection, and authentication email rate limits.
- Location: clear permission, timeout, unsupported-browser, and unavailable-position messages.
- NGO actions: loading/busy state and surfaced errors from RPC, RLS, database, upload, or session failures.
- Dashboard loading: the NGO dashboard shows loading and error states; it tells NGOs to add coordinates when they are absent.

Not found: server-side content moderation, duplicate-report validation, file-size enforcement in code, automated retry/offline queue, or a global error boundary.

## 14. Security approach

The security model is appropriate for a prototype when the supplied migrations are deployed:

- Supabase Auth identifies users and maintains sessions.
- Database RLS checks the authenticated identity (`auth.uid()`) for profile, NGO, report, image, assignment, and notification rules.
- React routes add a usability-level role guard; the database is the important protection boundary.
- NGO login additionally requires a valid linked NGO record.
- Sensitive report actions use security-definer functions that verify the caller’s NGO, assignment, location eligibility, and allowed state transition.
- The frontend reads only a publishable Supabase key from Vite environment variables. No service-role key is embedded in source.
- Basic client-side input validation is present.

Do not describe GeoClean as production-hardened: the current read policies expose profiles/NGOs to all authenticated users, storage reads are broad for authenticated users, role metadata is accepted during sign-up, and admin permissions are not implemented in RLS.

## 15. Responsive UI

The UI uses Tailwind utility classes plus custom CSS in `src/index.css`. Responsive breakpoints provide single-column mobile layouts, two-column tablet layouts, and multi-column desktop grids for cards/dashboards. The navigation becomes a collapsible mobile menu; report, NGO, and profile interfaces reuse components such as `DashboardLayout`, `ProtectedRoute`, `ReportModal`, report cards, modals, forms, and dashboard cards.

## 16. Performance and scalability

### Implemented

- Report lists are ordered by `created_at` descending.
- NGO notifications are limited to 25 records.
- Files are stored in Supabase Storage rather than inside PostgreSQL rows.
- The database runs proximity eligibility and atomic assignment checks, avoiding client-only trust for those operations.
- `report_code`, NGO `profile_id`, image type per report, and NGO/report assignment pairs have unique constraints. Primary/foreign keys provide the usual indexed key lookups.

### Future improvement

- Add pagination/cursor loading to reports; current lists load all accessible reports.
- Add purpose-designed indexes and a geospatial strategy (for example PostGIS/geography) before supporting a large number of coordinate searches. The current Haversine-style expression is correct for the 25 km rule but does not demonstrate an advanced geospatial index.
- Add image size/compression policy and shorter-lived URL/URL-refresh handling.
- Add observability, retries, caching, load testing, backup/recovery procedures, and a production deployment configuration.

## 17. Current limitations

- Deployment status of the included migrations is not verifiable from this repository alone.
- Citizen report location is optional; a report without coordinates cannot be matched as nearby by the database function.
- The displayed citizen address is a coordinate string, not geocoded address data.
- Citizen notifications page uses browser local storage/demo notices; only the NGO header fetches Supabase notification records. There is no real-time subscription in the code.
- The admin dashboard is local-storage/demo UI, with hard-coded statistics/users/NGOs; it is not a database administration system.
- My Reports has a delete control that does not delete the database report or storage data.
- There is no integrated map, notification delivery channel (push/SMS/email), routing/route optimisation, moderation, analytics backend, or municipal integration.
- One before and one after image are supported per report; image metadata stores a long-lived signed URL rather than the storage path.
- No pagination or documented production monitoring/recovery configuration is present.

## 18. Future scope (not currently implemented)

- AI-based waste-type classification and photo-quality checks.
- Duplicate-report detection using time, distance, and image similarity.
- Priority scoring based on hazard, report age, citizen confirmation, and local density.
- Route optimisation and work batching for NGO crews.
- Real-time in-app updates, push notifications, SMS/email notifications, and citizen assignment/resolution notices.
- Municipal/government workflow integration and verified NGO/admin onboarding.
- Proper analytics, exports, service-level metrics, and audit trails.
- Multilingual and accessibility enhancements, plus mobile applications.
- PostGIS/geospatial indexing and pagination for city-scale queries.

## 19. Complete technical data flow

```text
Citizen browser
  ↓
React form + local validation
  ↓
Supabase Auth session identifies user
  ↓
waste_reports insert (waste type, description, address string, optional coordinates)
  ↓                              ↘
PostgreSQL trigger sets code/time     optional image → Storage → report_images (before)
  ↓
If coordinates exist: trigger finds NGOs within 25 km and writes notification rows
  ↓
Eligible NGO dashboard query (RLS + distance function)
  ↓
accept_nearby_report RPC locks and assigns report
  ↓
assigned → in_progress
  ↓
After photo → Storage → report_images (after)
  ↓
update_assigned_report_status RPC verifies after photo → resolved
  ↓
Citizen My Reports query reads the new status
```

## 20. 3–5 minute judge explanation

> Technically, GeoClean follows a modern client-server architecture. The frontend is built with React and TypeScript, using React Router for separate citizen, NGO, and admin routes. The UI is responsive through Tailwind CSS and our own CSS, so the reporting form and dashboards work across mobile, tablet, and desktop layouts.
>
> Instead of building a separate Express server, we use Supabase directly as our backend platform. Supabase gives us email/password authentication, a PostgreSQL database, private image storage, and secure database functions. When a user signs up, Supabase Auth creates the account, and a database trigger automatically creates the matching profile. If the account is an NGO, it also creates its linked NGO record.
>
> A citizen can submit a waste report with a category, description, optional photo, and optional current location. The browser geolocation API provides latitude and longitude, which we store with the report. Photos are stored in a private Supabase Storage bucket, while the report table stores the report details and the image table stores the before/after image reference.
>
> The key technical feature is NGO matching. Each NGO can save its service coordinates. In PostgreSQL, our nearby-report function calculates whether a report is within 25 kilometres. Only eligible NGOs can see those nearby requests through the database security rules. When an NGO accepts a report, we call a PostgreSQL RPC function. It locks the report record, checks that it is still available and nearby, and assigns it. This makes the claim atomic, so two NGOs cannot successfully claim the same report at the same time.
>
> The work then follows a controlled lifecycle: available, assigned, in progress, and resolved. The assigned NGO uploads an after-cleaning photo before the database allows the report to be marked resolved. Citizens can then see the updated status in their My Reports screen.
>
> For security, Supabase Auth tells us who the user is, while Row Level Security decides what that user is allowed to access or change. We have implemented this for report ownership, NGO profile updates, image uploads, assignments, and notifications. As a prototype, we are transparent that the admin dashboard and citizen notification screens still need full backend integration. In a production phase, we would add real-time notifications, richer analytics, geospatial indexing, duplicate detection, and route optimisation.

## 21. Likely judge questions and concise answers

| Question | Answer grounded in the current project |
|---|---|
| Why did you choose Supabase? | It provides Auth, PostgreSQL, Storage, RLS, and database RPC functions in one backend platform, so the React app does not need a separate custom server for this prototype. |
| Why PostgreSQL? | The workflow needs related entities—users, NGOs, reports, images, assignments, and notifications—and PostgreSQL supports foreign keys, constraints, triggers, functions, and transactional locking. |
| How does authentication work? | Supabase Auth handles email/password sign-up and sign-in. After a session is established, the app loads the matching `profiles` row to obtain the user role. |
| How do you prevent a citizen account from entering the NGO dashboard? | The login flow compares the chosen role with the stored profile role, requires an NGO record for NGO sign-in, and `ProtectedRoute` redirects wrong-role users. Database checks protect sensitive actions too. |
| What is RLS? | Row Level Security is database-level access control. It checks the authenticated user identity for every allowed operation, so UI restrictions are not the only safeguard. |
| What can a citizen do with reports? | A citizen can insert a report only with their own `user_id` and read their own reports; the current code does not provide a database deletion flow. |
| How does an NGO get nearby reports? | The database compares the NGO and report latitude/longitude using a spherical-distance formula. The threshold implemented is 25 km, and both sides need coordinates. |
| How do you prevent two NGOs from claiming one report? | The claim is a PostgreSQL RPC that locks the report row with `FOR UPDATE`, validates availability, and assigns it inside the database. First valid claim wins. |
| Can an NGO resolve any report? | No. The status RPC verifies that the signed-in NGO is the report’s assigned NGO. It also permits only specific transitions. |
| Why is an after photo required? | The resolve RPC checks that an `after` record exists in `report_images` before it allows `in_progress` to become `resolved`. |
| Where are images stored? | In the private Supabase Storage bucket `report-images`; `report_images` stores the report link, image type, uploader, and time. |
| What happens if location permission is denied? | A citizen sees a message and can still submit without coordinates. That report will not qualify for the coordinate-based nearby-NGO matching. |
| Is a map API used? | No. The project uses the browser Geolocation API and PostgreSQL coordinate math; no map, geocoding, or route API is present. |
| Is there a custom backend server? | No. The React frontend uses the Supabase client directly, and protected workflow logic is implemented in PostgreSQL functions/triggers. |
| How does a citizen track a report? | My Reports queries `waste_reports` for the signed-in user, joins image metadata, and displays the current stored status and details. |
| Are notifications fully implemented? | The migration creates nearby-NGO notification records and the NGO header reads them. Citizen notifications are currently local-storage/demo UI, and no real-time subscription exists. |
| Is the admin panel production-ready? | No. The admin route and UI exist, but it uses local storage and hard-coded/demo values rather than a Supabase-backed admin workflow or RLS admin privileges. |
| How would you scale it? | Add pagination, geospatial indexing/PostGIS, image optimisation, observability, real-time delivery, and production operational practices. Supabase Storage already keeps large files out of database rows. |
| What happens if Supabase is unavailable? | Authentication, report reads/writes, images, and NGO workflow calls fail; the UI exposes errors in several flows. Offline queues or failover are not implemented. |
| What would you improve for production? | Verified onboarding/roles, stricter storage reads, server-side validation, real notifications, admin APIs, full audit/analytics, duplicate detection, and municipal integration. |

## 22. Implementation confidence matrix

| Feature | Implemented? | Technology/Method |
|---|---|---|
| Authentication | Yes | Supabase Auth email/password, sessions, password reset |
| Role-based access | Partial | React route guard + profile role checks; RLS has no special admin policy |
| Citizen reports | Yes | React report modal + `waste_reports` insert |
| Photo upload | Yes | Private Supabase Storage `report-images` + `report_images` metadata |
| Geolocation | Yes | Browser `navigator.geolocation`; optional report/NGO coordinates |
| NGO registration | Yes | Supabase sign-up metadata + auth trigger creates `profiles`/`ngos` |
| NGO dashboard | Yes | Supabase queries, RLS-filtered report lists, NGO workflow UI |
| Nearby reports | Yes | PostgreSQL 25 km spherical-distance function; requires coordinates |
| Report claiming | Yes | Atomic `accept_nearby_report` PostgreSQL RPC with `FOR UPDATE` |
| Status updates | Yes | Guarded `update_assigned_report_status` PostgreSQL RPC |
| Proof photo | Yes | NGO after-photo upload; required before resolution |
| RLS | Yes, with limitations | Policies for tables and Storage defined in migration; broad authenticated reads/no admin policy |
| Notifications | Partial | Database notification rows/NGO header fetch; citizen page is local-storage/demo; no real time |
| Admin functionality | Partial | Route/UI exists, but data/actions are local storage/demo rather than Supabase-backed |
| Analytics | Partial | NGO impact page calculates basic resolved/report-image counts; other dashboard statistics are demo values |

