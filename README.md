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
| Beacons | uploaded once via Connections → Import (`beacons-import.json` from the old site, or a Beacons `audience_list.csv`); stored in private Blob, never in git | manual |
| Fixes, drafts, unsubscribes | Vercel Blob (private) on Vercel; `./data/state.json` locally | — |

City resolution: a bundled GeoNames-derived index (`src/lib/seed/cities.json`, pop ≥ 5k) plus the 186 hand-cleaned answers from the old site (`seed/raw.json`).

## Deploy (Vercel)

1. Push this repo to GitHub. (No contact data lives in the repo — only city names/coordinates.)
2. Vercel → Add New Project → import the repo. Framework: Next.js, no changes needed.
3. Storage tab → Create **Blob** store → connect to the project (adds `BLOB_READ_WRITE_TOKEN`).
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

## Local dev

```bash
npm i
cp .env.example .env.local   # fill in what you have; leave SITE_PASSWORD empty to skip login
npm run dev
```

Without `WIX_API_KEY` the app shows the last saved Wix snapshot (empty on a fresh checkout) and no Beacons until you import.

`npm run build:cities` regenerates the city index from the `all-the-cities` package.
