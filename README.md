# Raye on the Road

Private audience map + show-email tool. Every page load pulls your subscribers and their
"where should I bring the tour?" answers straight from Wix — no exports.

- **Audience explorer** — map of everyone, pick a city + radius, see who's nearby
- **Your cities** — ranked list of where your people are
- **Show emails** — draft, review recipients, send via Resend (one-click unsubscribe included)
- **Needs a location** — answers the geocoder couldn't place; fix once, applies to everyone who wrote the same thing
- **Connections** — status of Wix / Beacons / Resend / storage, plus a Beacons CSV import

## How data flows

| Source | How | Freshness |
|---|---|---|
| Wix contacts + form submissions | Wix REST API, server-side, on every load (60 s cache; "Refresh from Wix" forces it) | live |
| Beacons | uploaded once via Connections → Import (`beacons-import.json` from the old site, or a Beacons `audience_list.csv`); stored in Supabase, never in git | manual |
| Fixes, drafts, unsubscribes | one JSON row in a Supabase `rotr_kv` table (free tier); `./data/state.json` locally | — |

City resolution: a bundled GeoNames-derived index (`src/lib/seed/cities.json`, pop ≥ 5k) plus the 186 hand-cleaned answers from the old site (`seed/raw.json`).

## Deploy (Vercel)

1. Push this repo to GitHub. (No contact data lives in the repo — only city names/coordinates.)
2. Vercel → Add New Project → import the repo. Framework: Next.js, no changes needed.
3. Supabase (free): create a project, run `supabase/schema.sql` in the SQL editor, then install the Supabase ↔ Vercel integration (it sets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the project).
4. Settings → Environment Variables (see `.env.example`):
   - `SITE_PASSWORD` — the dashboard password
   - `SESSION_SECRET` — any long random string
   - `WIX_API_KEY`, `WIX_SITE_ID` — see below
   - `RESEND_API_KEY`, `EMAIL_FROM` — e.g. `Raye Schiller <hello@rayeschiller.com>` (domain verified in Resend)
   - `SITE_URL` — `https://road.rayeschiller.com`
   - `MAILING_ADDRESS` — optional footer line
5. Settings → Domains → add `road.rayeschiller.com`; in Wix → Domains → DNS add the CNAME Vercel shows (`road` → `cname.vercel-dns.com`).
6. Redeploy, log in, Connections → Import Beacons → upload `beacons-import.json`.

### Wix API key

Wix dashboard → (top-right avatar) → **API Keys** → Generate API Key:
- Name: `raye-on-the-road`
- Permissions: **Read Contacts** (under Contacts & Members / CRM) and **Read Submissions** (under Wix Forms)
- Site ID: Wix dashboard URL looks like `manage.wix.com/dashboard/<SITE_ID>/…`

## Welcome email (replaces the Wix thank-you automation)

Everyone who signs up on rayeschiller.com gets the "you made it on the list! <3" email from
`hello@rayeschiller.com` via Resend: no Wix branding, reply-to hello@, one-click unsubscribe
(same list as show emails).

How it stays reliable: `/api/hooks/signup` takes **no data from the caller**. Each call
("someone may have signed up") makes the site read the last 7 days of form submissions from Wix
itself and welcome anyone not yet welcomed. It's called by:
- the Wix automation **Form submitted → Send HTTP request** (POST `https://road.rayeschiller.com/api/hooks/signup`), within seconds
- a daily Vercel cron (`vercel.json`), which catches anyone missed while the site, Wix, Resend or Supabase was down

Each address is welcomed once (log in Supabase key `welcome-email` + a Resend idempotency key).
The very first call only records a start time, so people who signed up earlier (and got the old
Wix email) are never emailed. If storage or Wix is unreachable, the run stops and the next one catches up.

- Copy & design: `src/lib/welcome.ts` (social links: `SOCIALS`) · signature: `public/email/signature.png`
- Logged-in preview: `/api/welcome/preview` · logged-in test send: `/api/welcome/test?to=you@example.com`
- Needs the existing `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, Wix and Supabase env vars; nothing new.

## Local dev

```bash
npm i
cp .env.example .env.local   # fill in what you have; leave SITE_PASSWORD empty to skip login
npm run dev
```

Without `WIX_API_KEY` the app shows the last saved Wix snapshot (empty on a fresh checkout) and no Beacons until you import.

`npm run build:cities` regenerates the city index from the `all-the-cities` package.
