# Chronicle

Your real life, kept like a game. Five pillars (Body, Skin, Mind, Work, Dopamine), each with four sub-stats.
Routines with real upsides and real costs. Goals on a map. A tree of people that fades when you go quiet.
Skills ranked 1 to 100. And every night, a thirty-minute Campfire log that becomes a letter waiting for you
in the morning, written by a game master who has read everything you ever told it.

The game master is Claude. Chronicle builds the prompt from layered memory (a State of Me, the last 14 nights,
month digests, tonight), you copy it, paste it into Claude, and paste the reply back. The app parses the reply
into the morning letter, three quests, stat changes, warnings, an insight and a lesson. Every prompt/reply pair
is kept as a dataset so a local model can take over later.

Everything lives on your device (IndexedDB). Nothing leaves it except what you copy yourself.

## Run it

```
npm install
npm run dev          # http://localhost:5173
```

```
npm run typecheck    # tsc, strict
npm test             # vitest (parser, prompt builders, compiler, game math, data layer)
npm run build        # typecheck + production PWA build into dist/
npm run e2e          # playwright against `vite preview` on :4173 (run build first)
```

`dist/` is a static site. Host it anywhere (GitHub Pages, Netlify, a `python -m http.server`). Open it on a
phone and use *Add to Home Screen* to install it: it works offline after the first load.

## Windows app

Download `Chronicle-Setup-<version>.exe` from the latest release and run it (Windows SmartScreen warns because
the installer is unsigned: *More info*, then *Run anyway*). It installs for your user only, adds Desktop and
Start menu shortcuts, and keeps your data in `%APPDATA%\Chronicle`. Every push to `main` publishes a new
version; the app downloads it in the background and offers to restart.

## Night 1

See [docs/night-1.md](docs/night-1.md) for the first evening: onboarding, the origin prompt, the first Campfire,
and what to expect the next morning. The short version:

1. Open the app, answer the Origin Sheet (118 questions, about 35 minutes, resumable).
2. Copy the origin prompt into Claude (Sonnet), paste the reply back. You get a State of Me, a first set of
   routines, skills and goals to accept or edit, and your first morning letter.
3. Tonight: Campfire. Tick routines, enter the numbers, meals, one line about the day, three questions.
   *Send tonight's log* copies the nightly prompt (Haiku is enough). Paste the reply back.
4. Tomorrow: the Morning screen has the letter, three quests, stat deltas and any warnings.

Prefer to look around first? *Try the demo first* on the welcome screen seeds a believable Day 23.

## Project layout

See [ARCHITECTURE.md](ARCHITECTURE.md). In one paragraph: `src/app` is the shell and router, `src/ui` the
Paper design system (tokens, primitives, pixel sprites, the copy→paste hand-off component), `src/data` the
Dexie schema, repositories and live hooks, `src/lib` the pure logic (game math, prompt builders, parsers,
the Origin Sheet compiler, dates), and `src/features/*` one folder per screen.

## Status

v1 is the web app: all seven screens (Onboarding, Morning, Campfire, You, Map, People, Vault) plus the editors,
the paste loop with six prompt kinds (origin, nightly, weekly, monthly, skill rank, lore), the demo world,
JSON backups and the JSONL dataset export. 330+ unit tests and a Playwright suite that plays Night 1 end to end
on phone and desktop. Pushing to `main` deploys to GitHub Pages (`.github/workflows/pages.yml`; turn on
*Settings → Pages → Source: GitHub Actions* once).
Later phases (see the spec): sync across devices, progress photos, money, health sync, wardrobe, native
notifications via Capacitor, and a local model fine-tuned on your own prompt/reply pairs.
