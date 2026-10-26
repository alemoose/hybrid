# Log

A personal food and gym log, in the "Paper Night" style. It's built for one person, and you add it to your phone's home screen like an app.

**Gym**

- Routines that run in order (Push → Pull → Legs → …). Today shows which one is next, with your targets.
- A live workout screen with a Previous column, warm-up, drop and failure sets, a rest timer that chimes, and the screen kept awake. The workout in progress is saved on the phone, so a reload never loses it.
- Next-session targets. Hit every rep and the next workout adds weight. Miss reps and it keeps the weight and adds a rep. Three stalled sessions in a row suggests a 10% deload.
- A progress chart for every exercise (estimated max, heaviest, best set, volume), plus personal records and history.

**Food, sodium, water, spending**

- Type, say or photograph what you ate. Claude looks up a chain's official nutrition with web search, reads labels from photos, and estimates local spots. Every item can be edited before you log it.
- Calories, protein, carbs, fat and **sodium** against your goals. The sodium target rises a little on training days.
- A **water** goal from body weight, plus extra for training and after a salty day, with one-tap +8 / +16.9 / +32 oz.
- **Spending**: add what a meal cost, then see it per day, per week, and by restaurant.
- Usuals: save a regular order once and log it again with one tap, price included. Lookups are saved too, so the same description never costs twice.

**Everywhere**

- A calendar where you tap any day to see food, sodium, water, spend and workouts. A 7-day strip sits on Today.

## Run it locally

```bash
npm install
npm run dev        # migrates local.db, then starts http://localhost:3000
```

Without `APP_PASSWORD` set, local development is open. To try the login, put a password in `.env.local`:

```
APP_PASSWORD=pick-something
```

Other scripts: `npm test` (training, food and lookup logic), `npm run lint`, `npm run typecheck`, `npm run db:generate` (after changing `src/lib/db/schema.ts`).

## Deploy to Vercel

1. Import this repo in Vercel.
2. Add a database. In the Vercel project, open **Storage** (Marketplace) and add **Turso**, or create a database at turso.tech yourself. Either way, the project needs these environment variables:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
3. Add `APP_PASSWORD`, the password you'll type on your phone. Optionally add `SESSION_SECRET`, a long random string.
4. Add `ANTHROPIC_API_KEY` (from platform.claude.com → API Keys) to switch on food lookups. Without it, meals can still be entered by hand. Lookups use Claude Opus 5.5: a typed meal costs a few cents, and a first-time chain lookup about 10–20¢. Set a monthly limit in the Claude Console.
5. Deploy. The build applies database migrations and loads the exercise library automatically.

On your phone, open the site and choose **Share → Add to Home Screen**.

## How it's built

- Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS 4
- SQLite via libSQL and Drizzle ORM: a local file in development, Turso in production
- `src/lib/training.ts` holds the progression math (Epley estimated max, double progression, deload). `src/lib/nutrition.ts` holds the food math (water and sodium goals, restaurant cooking adjustment). Both have tests next to them.
- `src/lib/ai/estimate.ts` makes the Claude call: web search for chain nutrition, plus a strict `record_meal` tool so the numbers always come back in the same shape.
- `src/proxy.ts` gates every page behind the password cookie. Every server action re-checks it.
