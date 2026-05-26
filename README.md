# Bibliteracy

A faith and biblical literacy app: an endless, pannable "paper" grid that lays out the Bible canon proportionally above three time-axis lanes for **Logos + Rhema**, **Prayer**, and **Discipleship** notes — with always-on and per-dot live video rooms for invited guests.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + shadcn-style primitives
- **Supabase** — Auth, Postgres (with Row Level Security), Storage, Realtime
- **LiveKit Cloud** — WebRTC SFU for live audio/video rooms
- **TanStack Query** for server state, **Zustand** for grid view state
- **Vitest** for unit tests; **GitHub Actions** for lint / typecheck / test / build CI
- Deployed on **Vercel**

## Layout

The app is one full-viewport "canvas":

1. **BooksLane** — the 66 books of the Bible, **TaNaK order** (Torah → Nevi'im → Ketuvim) for the Old Testament and traditional order for the New Testament. Each book's segment width is proportional to its KJV word count relative to the whole Bible.
2. **TimeRuler** — sticky beneath BooksLane, with **today centered** on load. Pinch / Cmd+wheel zooms across day/week/month/quarter/year scales.
3. **LogosLane** / **PrayerLane** / **DiscipleshipLane** — aligned to the time ruler. Each day is a cell that can hold zero, one, or many "dots". Click a dot to open the side sheet; click the lane's "+" to add a new dot anchored to today (or the selected date).

Discipleship dots can host live LiveKit rooms; every owner also has an always-on `/lounge` room.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + LiveKit values
npm run dev
```

Open http://localhost:3000.

The grid requires Supabase. Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (or run the local stack — see
[Database workflow](#database-workflow-supabase-cli)) so every user's dots
live behind their own account with RLS-enforced isolation. Without those
vars the home page shows a sign-in prompt instead of the grid.

### Google sign-in

The login page offers "Continue with Google" alongside the email magic link.
Both flows hit `/auth/callback`, which exchanges the OAuth/PKCE code for a
session — no extra app code is needed to enable Google.

To turn it on for a deployment:

1. **Google Cloud Console** → APIs & Services → Credentials → "Create OAuth
   client ID" (type: Web application). Add this authorized redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
2. **Supabase Dashboard** → Authentication → Providers → Google → paste the
   client ID + secret and enable the provider.
3. **Supabase Dashboard** → Authentication → URL Configuration → add your
   site URL (e.g. `https://example.com`) and add `https://example.com/auth/callback`
   to the redirect allow-list. For local dev add **both**
   `http://localhost:3000/auth/callback` and `http://127.0.0.1:3000/auth/callback`
   (use the same hostname in the browser that you listed). If Google sign-in
   still lands on production, the allow-list on the **hosted** project is
   missing those URLs — mirror `supabase/config.toml` with
   `npx supabase config push --linked` or paste the entries manually.

### Live video (LiveKit on Vercel)

The lounge and dot live rooms need three variables in **Vercel → Project
Settings → Environment Variables** (Production, and Preview if you use it):

- `NEXT_PUBLIC_LIVEKIT_URL` — WebSocket URL from [cloud.livekit.io](https://cloud.livekit.io)
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` — from the same project’s API keys

Copy the values from your local `.env.local` (do not commit that file). After
adding or changing `NEXT_PUBLIC_*`, **redeploy** so the build picks up the
public URL. Optional server-only alias: `LIVEKIT_URL` (same `wss://…` value)
if you prefer not to duplicate the URL under two names.

For the local Supabase stack, set these in `supabase/config.toml` (or env
vars) before `npm run db:start`:

```
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_GOOGLE_SECRET)"
redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
```

### Bible translations

The reader pulls Scripture text from three kinds of providers:

- **bolls.life** (default) — keyless, public, serves dozens of translations
  including Strong's-tagged KJV / ASV / WLCa / TISCH, the modern public-domain
  WEB / BSB / LSV / YLT, and many copyrighted translations that the operator
  is responsible for licensing before public deployment.
- **Crossway ESV API** — set `ESV_API_KEY` in `.env.local` to enable the
  official ESV. Free tier: ~5,000 verses/day, non-commercial.
  Sign up at https://api.esv.org/account/create-application/.
- **Tyndale NLT API** — set `NLT_API_KEY` in `.env.local` to enable the
  official NLT. Sign up at https://api.nlt.to/.
- **Bible.org NET API** — keyless, no setup needed; rate-limited by IP per
  https://labs.bible.org/api_web_service.

The translation picker in the reader header disables entries whose env keys
aren't set in the running deployment, and shows the publisher's attribution
under each verse for the ESV/NLT/NET sources.

## Database workflow (Supabase CLI)

Schema lives in [`supabase/migrations/`](supabase/migrations) as plain SQL.
The Supabase CLI (installed as a dev dependency) runs them locally and a
GitHub Action pushes them to production on merge to `main`.

### Local development against a real Postgres

Requires Docker Desktop / Colima.

```bash
npm run db:start      # boot local Postgres + Studio + Auth + Storage
npm run db:status     # see local URLs (Studio at http://localhost:54323)
npm run db:reset      # drop, re-apply every migration, run seed.sql
npm run db:stop       # tear down
```

Magic-link emails sent in local dev are captured by Inbucket at
http://localhost:54324 — no real email is sent.

### Authoring a new migration

```bash
npm run db:new add_attachments_bucket
# edit supabase/migrations/<timestamp>_add_attachments_bucket.sql
npm run db:reset      # verify it applies cleanly to a fresh DB
```

If you'd rather hand-edit the local DB (e.g. via Studio) and let the CLI
diff out the SQL for you:

```bash
npm run db:diff some_descriptive_name
```

### Linking to your cloud project (one-time, on your machine)

```bash
npm run db:link -- --project-ref <your-project-ref>
# follow prompts; this writes .git-ignored credentials under supabase/
```

After linking, you can push migrations manually with `npm run db:push`. In
practice you won't need to — the GitHub Action does it for you.

### Auto-deploy on push to main

`.github/workflows/db-deploy.yml` runs `supabase db push` against your linked
project whenever a PR that touches `supabase/` is merged into `main`.

`.github/workflows/db-validate.yml` runs on every PR: it spins up a fresh
local Supabase stack, applies all migrations + `seed.sql` from scratch, and
lints the schema. A red check here means production won't get the change.

**Required GitHub Action secrets** (Repository → Settings → Secrets → Actions):

| Secret | Where to find it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_PASSWORD` | Project → Settings → Database → "Database password" |
| `SUPABASE_PROJECT_ID` | Project → Settings → General → "Reference ID" |

## Project layout

```
app/                  Next.js App Router pages and API routes
components/grid/      The endless-paper grid (canvas, lanes, dots)
components/live/      LiveKit room embeds
lib/bible/            Bible canon, KJV verse counts, parser, cross-references
lib/supabase/         SSR + browser Supabase clients
supabase/migrations/  SQL schema + Row Level Security policies
tests/                Vitest unit tests for every module under lib/ and the
                      Bible API route handlers
```

## Testing

Bibliteracy ships with a Vitest suite that runs on every PR through the `ci`
GitHub Action.

```bash
npm run test              # run all tests once
npm run test:watch        # interactive watch mode
npm run test:coverage     # text + lcov + html coverage reports
npm run verify            # lint + typecheck + test, the same gate CI runs
```

## Biblical accuracy

Several layers of the codebase enforce that we ship a Bible app worthy of
the name:

- [`lib/bible/books.ts`](lib/bible/books.ts) — every one of the 66 canonical
  books, in TaNaK + traditional NT order, with original-language word counts
  (Hebrew Masoretic Text and Greek NA28). Unit tests verify counts, ordering,
  and that OT ≈ 305,411 / NT ≈ 138,020 within 1%.
- [`lib/bible/versesPerChapter.ts`](lib/bible/versesPerChapter.ts) — the full
  KJV verses-per-chapter dataset for every chapter. Tests assert the
  universally-agreed totals: **31,102** total verses (23,145 OT + 7,957 NT),
  Psalm 117 = 2 verses (the shortest), Psalm 119 = 176 (the longest), and
  consistency with `BIBLE_BOOKS.chapters`.
- [`lib/bible/parseRef.ts`](lib/bible/parseRef.ts) — accepts every standard
  English alias (e.g. "Gen", "Genesis", "Gn", "Song of Songs", "Cant", "Apoc")
  and validates verse ranges against the KJV verse-count dataset, so
  references like `"Psalm 117:5"` (chapter has only 2 verses) cleanly fail
  to parse.
- [`lib/bible/crossRefs.ts`](lib/bible/crossRefs.ts) — a curated dataset of
  high-confidence cross-references drawn from the Treasury of Scripture
  Knowledge (R. A. Torrey, 1834, public domain), the UBS5 index of NT
  quotations of OT, and the standard Aland Synopsis. Tests mechanically
  verify that **every** reference in the dataset resolves to a real book,
  chapter, and verse range.
- `GET /api/bible/xrefs?ref=John+3:16` — server endpoint that exposes the
  curated cross-references; the BibleReader uses it to render clickable
  "see also" chips below the active verse.

## Roadmap

See [.cursor/plans/bibliteracy-app-mvp_3bd78037.plan.md](.cursor/plans/bibliteracy-app-mvp_3bd78037.plan.md) for the milestone breakdown (M0 → v1).
