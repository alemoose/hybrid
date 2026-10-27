# Hybrid

A personal food and gym log, in the "Paper Night" style. It's built for one person, and you add it to your phone's home screen like an app.

**Gym**

- Routines that run in order (Push → Pull → Legs → …). Today shows which one is next, with your targets.
- A live workout screen with a Previous column, warm-up, drop and failure sets, a rest timer that chimes, and the screen kept awake. The workout in progress is saved on the phone, so a reload never loses it.
- Next-session targets. Hit every rep and the next workout adds weight. Miss reps and it keeps the weight and adds a rep. Three stalled sessions in a row suggests a 10% deload.
- Rec center live counts on the Gym tab (University of Alabama UREC, through its Connect2Concepts feed), plus the usual quiet hours, built from the counts the app has seen. If the feed can't be found automatically, paste the live-counts page link in Settings.
- A progress chart for every exercise (estimated max, heaviest, best set, volume), plus personal records and history.

**Food, sodium, water, spending**

- Type, say or photograph what you ate. Claude looks up a chain's official nutrition with web search, reads labels from photos, and estimates local spots. Every item can be edited before you log it.
- Calories, protein, carbs, fat and **sodium** against your goals. The sodium target rises a little on training days.
- A daily **creatine** check (5 g) on Today with a streak and the last 7 days, also shown on the calendar.
- A **water** goal from body weight, plus extra for training and after a salty day, with one-tap +8 / +16.9 / +32 oz.
- **Spending**: add what a meal cost, then see it per day, per week, and by restaurant.
- Usuals: save a regular order once and log it again with one tap, price included. Lookups are saved too, so the same description never costs twice.

**Goals**

- First-run setup: current weight, height, age and activity lead to suggested calories and macros (Mifflin-St Jeor), then goal weight and pace, sodium, water, starter routines, and a physique goal. You can run it again from Settings.
- Goal weight with a 7-day-average trend, the weekly rate, and a projected date. The chart shows a dashed line to the goal.
- A physique goal: your inspiration photo plus numbers that track it (V-taper shoulders ÷ waist, waist, pull-ups, or any lift).
- Progress photos (front / side / back) with a camera that overlays your last photo so you match the pose, plus side-by-side comparison. Photos are stored in your database and only served behind your login.
- Measurements, and strength goals that use your best estimated max (or reps) from recent sessions.

**Check-ins and suggestions**

- A weekly check-in: average calories and protein against your goals, the weight trend against your pace, workouts, salty days and spending. When the scale is off pace and you've been eating your goal, it suggests a 100–200 kcal change (carbs absorb it) that you apply with one tap, then waits two weeks before suggesting another. If you haven't been eating your goal, it says that instead.
- "What should I order?": three orders from your regular spots (or one you name) that fit the calories and protein you have left. Tap one to review and log it.
- Reminders of her: reasons you love her and a few photos, shown when a workout starts, between sets, when the rec is busy, and every few days on Today.

**Everywhere**

- A calendar where you tap any day to see food, sodium, water, spend, weigh-ins and workouts. A 7-day strip sits on Today.

## Run it locally

```bash
npm install
npm run dev        # migrates local.db, then starts http://localhost:3000
```

Without `APP_PASSWORD` set, local development is open. To try the login, put a password in `.env.local`:

```
APP_PASSWORD=pick-something
```

Other scripts: `npm test` (training, food, body and lookup logic), `npm run lint`, `npm run typecheck`, `npm run db:generate` (after changing `src/lib/db/schema.ts`).

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
