[README.md](https://github.com/user-attachments/files/22364195/README.md)
# Manhattan Runs (Strava → Mapbox on GitHub Pages)

A tiny site that renders your Strava runs over Manhattan with Mapbox GL, shows a **“To Date: N mi”** counter, and (optionally) **excludes runs that are mostly inside Central Park**.  
Data is refreshed automatically via GitHub Actions and committed to the repo as `manhattan-runs.json`.

---

## What’s in here

```
.
├── index.html                      # Map + counter + Central Park filter (client-side)
├── manhattan-boundary.json         # Manhattan polygon (WGS84)
├── central-park-boundary.json      # Central Park polygon (WGS84)
├── manhattan-runs.json             # GENERATED: filtered runs (updated by workflow)
├── strava-integration.js           # Your map layer logic (consumes manhattan-runs.json)
└── .github
    ├── scripts
    │   ├── fetch-strava-runs.js    # Node script to create manhattan-runs.json
    │   └── (optional utilities)
    └── workflows
        ├── get-refresh-token.yml   # Manual: exchange auth code → refresh token
        └── sync-strava.yml         # Scheduled/manual: refresh + fetch + commit json
```

---

## Prerequisites

- **Strava API app**: <https://www.strava.com/settings/api>  
  You’ll need the **Client ID** and **Client Secret**.
- **Mapbox account** & **public access token**: <https://account.mapbox.com>  
  (Replace the token in `index.html` or pass via secret if you prefer.)
- **GitHub Pages** enabled for this repo (Settings → Pages → “Deploy from a branch”, e.g., `main` / `/ (root)`).

> **Authorization Callback Domain** (in Strava app) must match your Pages host.  
> Examples:
> - `USERNAME.github.io` (if serving from `https://USERNAME.github.io/REPO`)  
> - custom domain like `runs.yourdomain.com`

---

## Secrets to set (Repo → Settings → Secrets and variables → **Actions**)

Required:
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN` (seed once—see next section)
- `MAPBOX_ACCESS_TOKEN` (if you want to inject, or just hardcode in `index.html`)

Optional (enables auto-rotation of refresh token):
- `GH_TOKEN` → a repo-scoped Personal Access Token with permission to **write Actions secrets** (`repo` scope works).

---

## Seed the initial Strava refresh token (one-time)

1) Build this authorize URL (replace `YOUR_ID` and `REDIRECT_URI`):

```
https://www.strava.com/oauth/authorize?client_id=YOUR_ID&response_type=code&redirect_uri=ENCODED_REDIRECT_URI&scope=read,activity:read_all&approval_prompt=force
```

- Example redirect if your callback page is `/strava-callback.html`:
  - Redirect URI (encoded): `https%3A%2F%2FYOUR_HOST%2Fstrava-callback.html`
  - Host must match your Strava app’s “Authorization Callback Domain(s)”.

2) Authorize → you’ll land on your callback page with `?code=...`. Copy the **code** (just the value).

3) In repo secrets, set **`YOUR_AUTHORIZATION_CODE`** to that value.

4) Run **Actions → Get Strava Refresh Token → Run workflow** on `main`.  
   - In the logs, copy **Refresh token: …**.

5) Set repo secret **`STRAVA_REFRESH_TOKEN`** to that new refresh token.  
   - You can delete `YOUR_AUTHORIZATION_CODE` after this (it’s one-time).

> You don’t need to keep the access token printed by this job. Access tokens are short-lived; the sync job gets a fresh one each time.

---

## How the daily sync works

Workflow: `.github/workflows/sync-strava.yml`

- **Step 1 – Refresh**  
  Posts to `https://www.strava.com/api/v3/oauth/token` with `grant_type=refresh_token` (form-encoded), using your `STRAVA_REFRESH_TOKEN`.  
  Strava returns a **new access token** **and a new refresh token** (Strava rotates refresh tokens on every refresh).

- **Step 2 – Fetch runs**  
  Runs `node .github/scripts/fetch-strava-runs.js`, which:
  - gets recent activities from Strava (using the fresh **access token**),
  - decodes polylines / optionally snaps to roads (Mapbox Map Matching),
  - detects whether each run intersects Manhattan,
  - writes `manhattan-runs.json`.

- **Step 3 – Commit**  
  Commits `manhattan-runs.json` if it changed.

- **Step 4 – (Optional) Auto-rotate secret**  
  If `GH_TOKEN` is present, the workflow updates **`STRAVA_REFRESH_TOKEN`** to the newest value so the next run continues to work.

You can also **Run workflow** manually from the Actions tab.

---

## Frontend (index.html)

- Uses Mapbox GL to render the basemap and your runs from `manhattan-runs.json`.
- Shows a **To Date: N mi** counter (rounded miles).
- **Central Park exclusion** happens **client-side**:
  - Runs are filtered out when **> 60%** of sampled points fall inside the **Central Park** polygon (`central-park-boundary.json`).
  - There’s also an optional “mostly in Manhattan” requirement (see **Tuning filters** below).

### Tuning filters

Inside `index.html`, look for the filter installer (search `installRunsFilter`). You can tweak:

```js
const MANHATTAN_MIN_FRAC = 0.50;    // require ≥ 50% of points inside Manhattan
const CENTRAL_PARK_MAX_FRAC = 0.60; // require ≤ 60% inside Central Park
```

Set `MANHATTAN_MIN_FRAC = 0` if you already filter to Manhattan server-side.

---

## Boundaries

- `manhattan-boundary.json`: a single **Feature/Polygon** in WGS84.  
- `central-park-boundary.json`: a single **Feature/Polygon** in WGS84.

### Getting a Central Park polygon

- **Draw** at <https://geojson.io> (fastest). Save as GeoJSON.  
- Or **download** from OpenStreetMap (Overpass Turbo) / NYC Open Data and convert with <https://mapshaper.org>.

If your CP file exported as a FeatureCollection or LineString, reformat to:

```json
{
  "type": "Feature",
  "properties": { "name": "Central Park", "borough": "Manhattan" },
  "geometry": { "type": "Polygon", "coordinates": [ ...closed ring... ] }
}
```

*(The README assumes you already placed both JSONs in the repo root.)*

---

## GitHub Pages

1) Settings → Pages → “Build and deployment”: “Deploy from a branch”.  
2) Branch: `main`, Folder: `/ (root)`. Save.  
3) Your site will be available at `https://USERNAME.github.io/REPO/` (or your custom domain).

If you use a **custom domain**, set DNS and update the Strava app’s **Authorization Callback Domain** accordingly (host must match).

---

## Common issues & fixes

- **No “Run workflow” button / workflow name shows as file path**  
  → YAML syntax error. Ensure the workflow starts with `name:` and indentation uses **spaces** (no tabs). Run from **Actions → [workflow] → Run workflow** (don’t “Re-run” an old job, which replays old YAML).

- **`refresh_token invalid`**  
  - Use **`/api/v3/oauth/token`** and **`Content-Type: application/x-www-form-urlencoded`**.  
  - Ensure you’re using the **latest** refresh token. Strava rotates it on every refresh.  
  - Confirm `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` match the same Strava app you authorized.  
  - Trim whitespace in secrets.

- **Activities 403 / missing runs**  
  → Re-authorize with `scope=read,activity:read_all`, then reseed the refresh token.

- **Everything gets filtered out**  
  - Your CP polygon may be wrong (too big). Check the console log in DevTools; CP area should be ~**3.41 km²**.  
  - Relax thresholds (e.g., set `CENTRAL_PARK_MAX_FRAC = 0.8`).  
  - Ensure coordinates are `[lng, lat]` (not `[lat, lng]`).

- **Module not found (`node-fetch`)**  
  → On Node 18+, use built-in `fetch` or the `https` module. No `node-fetch` needed.

---

## Customization

- **Color**: change `--run-orange` in `index.html`.  
- **Hide Central Park overlay**: delete the `central-park-*` layers (and source) in `index.html`.  
- **Counter text**: in `renderMilesCounter()`, update `"To Date: ${formatted} mi"`.

---

## Safety & secrets

- Never commit tokens to the repo.  
- Use GitHub Actions **Secrets**.  
- If you regenerate the Strava **Client Secret**, you must re-authorize and reseed `STRAVA_REFRESH_TOKEN`.

---

## Quick Start (TL;DR)

1. Create Strava app; set **Authorization Callback Domain** to your Pages host.  
2. Add secrets: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `MAPBOX_ACCESS_TOKEN`.  
3. Get an auth **code** (via the authorize URL) → run **Get Strava Refresh Token** → save the **refresh token** as `STRAVA_REFRESH_TOKEN`.  
4. Enable **GitHub Pages**.  
5. Run **Sync Strava Runs Daily** (manually first) → it will refresh → fetch runs → commit `manhattan-runs.json`.  
6. Open your site. You should see the map + **To Date** counter, with runs filtered by the Central Park rule.
