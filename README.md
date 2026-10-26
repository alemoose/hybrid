# Log

A personal food and gym log, in the "Paper Night" style. It's built for one person, and you add it to your phone's home screen like an app.

**What's in it so far: the gym log**

- Routines that run in order (Push → Pull → Legs → …). Today shows which one is next, with your targets.
- A live workout screen with a Previous column, warm-up, drop and failure sets, a rest timer that chimes, and the screen kept awake. The workout in progress is saved on the phone, so a reload never loses it.
- Next-session targets. Hit every rep and the next workout adds weight. Miss reps and it keeps the weight and adds a rep. Three stalled sessions in a row suggests a 10% deload.
- A progress chart for every exercise (estimated max, heaviest, best set, volume), plus personal records and history.
- A calendar where you tap any day to see what you did, and a 7-day strip on Today.

Food logging is next.

## Run it locally

```bash
npm install
npm run dev        # migrates local.db, then starts http://localhost:3000
```

Without `APP_PASSWORD` set, local development is open. To try the login, put a password in `.env.local`:

```
APP_PASSWORD=pick-something
```

Other scripts: `npm test` (training math), `npm run lint`, `npm run typecheck`, `npm run db:generate` (after changing `src/lib/db/schema.ts`).

## Deploy to Vercel

1. Import this repo in Vercel.
2. Add a database. In the Vercel project, open **Storage** (Marketplace) and add **Turso**, or create a database at turso.tech yourself. Either way, the project needs these environment variables:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
3. Add `APP_PASSWORD`, the password you'll type on your phone. Optionally add `SESSION_SECRET`, a long random string.
4. Deploy. The build applies database migrations and loads the exercise library automatically.

On your phone, open the site and choose **Share → Add to Home Screen**.

## How it's built

- Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS 4
- SQLite via libSQL and Drizzle ORM: a local file in development, Turso in production
- `src/lib/training.ts` holds the progression math (Epley estimated max, double progression, deload). It's covered by `src/lib/training.test.ts`.
- `src/proxy.ts` gates every page behind the password cookie. Every server action re-checks it.
