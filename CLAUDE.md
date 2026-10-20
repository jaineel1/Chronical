# Chronicle — conventions

Chronicle is a local-first web app that keeps a person's real life as a game: five pillars (Body, Skin, Mind,
Work, Dopamine) with four sub-stats each, routines with real costs, goals on a map, a people tree, and a
nightly "Campfire" log that is compiled into a prompt, pasted into Claude, and whose tagged-markdown reply is
parsed back into a Morning letter, quests, stat deltas, warnings, insights and a lesson.

Read this file before touching anything. The design mockups this app must match live outside the repo (the
agent brief points at them); the exact colours, fonts and layout rules are below.

## Commands

```
npm run dev          # vite dev server
npm run typecheck    # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm test             # vitest run (jsdom + fake-indexeddb)
npm run build        # typecheck + vite build (PWA)
npm run e2e          # playwright (builds nothing; runs against `vite preview` on :4173 — run `npm run build` first)
npm run icons        # regenerate public/icons from scripts/icons.mjs
```

All three of `typecheck`, `test`, `build` must be green before you report done.

## Stack

Vite 6 · React 19 · TypeScript strict · Tailwind v4 (`@theme` tokens in `src/theme/tokens.css`) · react-router v7
(**HashRouter**, so links are `#/campfire`) · Dexie 4 + `dexie-react-hooks` (IndexedDB) · vite-plugin-pwa ·
self-hosted fonts via `@fontsource` (no network fonts) · Vitest · Playwright.

Path alias: `@/` → `src/`. No default exports. Named exports, one component per file where it matters.

## Repo map and ownership

```
src/app/            router (App.tsx), Shell (top bar, bottom nav, desktop rail, Page), RequireOnboarded     — foundation
src/theme/          tokens.css                                                                            — foundation
src/ui/             primitives.tsx, icons.tsx, PixelSprite.tsx, sprites.ts                                 — foundation (add, don't rewrite)
src/data/           types.ts, db.ts (Dexie schema), repo.ts (repositories), hooks.ts (live hooks), seed.ts  — foundation (add, don't rewrite)
src/lib/dates.ts    day keys, rollover, formatting                                                         — foundation
src/lib/game/       level.ts (foundation) · pillars/streaks/shields/daily delta (Agent Loop)
src/lib/prompt/     nightly.ts, origin.ts, weekly.ts, deep.ts (Agent Loop) · skill.ts, lore.ts (Agent World)
src/lib/parse/      reply.ts — the tagged-markdown parser (Agent Loop)
src/lib/compile/    originSheet.ts — 118 answers → markdown (Agent Onboarding+Vault)
src/features/morning, campfire       Agent Loop
src/features/onboarding, vault       Agent Onboarding+Vault
src/features/you, map, people, editors   Agent World
```

Stay inside your directories. If you need something from a shared file (`types.ts`, `repo.ts`, `hooks.ts`,
`primitives.tsx`, `sprites.ts`), **add** a new export; never rename or change the signature of an existing one.
Put feature-specific helpers in your own feature folder.

## Data layer rules

- Screens read through hooks in `src/data/hooks.ts` (`useLiveQuery`) or write through repositories in
  `src/data/repo.ts`. Screens never import `db` directly except for read-only `useLiveQuery` callbacks that
  are specific to one screen (put those in `src/features/<x>/queries.ts`).
- Every row has `id`, `createdAt`, `updatedAt`. Create rows with `stamp<T>(draft)`; update with `patch`
  or the repo's `update`. Never hand-write timestamps.
- Day keys are `'YYYY-MM-DD'` with a 4 AM rollover: `todayKey(profile.settings.rolloverHour)`. A log at
  1 AM belongs to the previous day. Use helpers from `@/lib/dates`; never `new Date().toISOString().slice(0,10)`.
- `DayLog.date` is unique. `dayLogRepo.ensure(date)` creates it on first touch.
- Points and levels: sub-stats hold points; `pillar.points` = mean of its four sub-stats and is recomputed by
  `gameRepo.addPoints` / `setSubStatPoints`, never written directly. Level = `10 × log2(1 + points/50)`
  (`levelFromPoints` in `src/lib/game/level.ts`), one decimal, no cap. A pillar-level delta ("Body +2")
  moves all four sub-stats by +2; a sub-stat delta ("Body/Endurance +2") moves one sub-stat by +2.
- Nothing leaves the device unless the player copies text or pastes it. There is no network code in v1
  except the optional BYO API key path in the Vault (off by default).
- Demo world: `seedDemo()` in `src/data/seed.ts` (Day 23, mirrors the mockups). `settings.demo === true`
  while it is active. `DEMO_REPLY_MD` is the canonical sample reply: the parser must parse it, and the Morning
  screen must render the seeded `DayLog` for yesterday exactly as the Morning mockup shows.

## Game rules (from the spec — implement exactly)

- Daily pillar delta = Σ weights of routines done − 0.5 × Σ weights of scheduled routines skipped, floored at −5.
- One shield per routine per week (`Routine.shields`, reset when `shieldWeek !== weekKey(today)`); a shield
  silently covers one miss and keeps the streak. A break after that produces a **warning**, never a penalty.
- Skills are 1–100; +0.1 per logged hour between Claude assessments. Bands: Beginner 1–19, Capable 20–39,
  Solid 40–59, Advanced 60–79, Expert 80–94, Elite 95–100.
- Nightly prompt = system rules + State of Me + last 14 day logs (compressed) + month digests + tonight.
  Deep mode adds the last 90 logs and the Origin Sheet. `excludeMoney` strips money figures.
- Reply format (headers exact, order free, unknown headers kept verbatim as extra sections):

```
## BRIEF            letter, 150–400 words
## AFFIRMATIONS     - lines; each must contain a number or a noun from the player's log (else flagged)
## QUESTS           - [Pillar] text | reward: text
## STATS            Body +2 · Mind -1 · Body/Endurance +1 · Running 62 -> 64
## WARNINGS         - lines
## INSIGHTS         - lines
## LESSON           one sentence
```

  Missing `## BRIEF` → reject the paste, keep it in `DayLog.rawDraft`, tell the player what is missing.

## Visual system ("Paper") — match the mockups

Tokens (Tailwind classes): `bg-paper` #ebe3d4 sheet · `bg-paper-2` #e3d9c6 shaded section headers ·
`faint` #cfc3ae rules, tracks, dashed empties · `mid` #8a4a52 secondary text and bar fill · `ink` #3a1219
text, top/bottom bands, filled pixels · `red` #b8323b **signals only** (sun, drop cap, negative deltas,
warnings) · `walnut` #6b3f2a buttons · `bar-muted` / `bar-text` text on ink bands.

- Fonts: `font-pixel` (DotGothic16, 16px, line-height 1.25) for all UI; `font-serif` (Newsreader) only for
  the letter (`.letter` class, with `<span class="drop">D</span>` pixel drop cap) and long free text inputs.
- No cards, no shadows, no rounded corners, no gradients, no emoji. Structure = `SectionHeader` (shaded strip,
  title left, muted note right) + `Section` (indented content). Hairlines between rows where needed.
- Bars: `Bar` / `StatRow` from `src/ui/primitives.tsx`. 4px for pillars, 2px for sub-stats. Negative deltas red.
- Map regions are bordered blocks (`border border-faint`) with a shaded header; the lowest pillar region shows
  hatched "fog" (`repeating-linear-gradient` in faint).
- One primary action per screen: a walnut `Button`. Secondary actions are `outline` or `text` buttons.
- Pixel art: `PixelSprite` with maps from `src/ui/sprites.ts`; integer scales only; never scale with CSS
  transforms. The wrapper has the sprite's true size, so position it like any box (`className="absolute …"`).
- Shell: screens call `useShellBar(title, meta)` to set the ink top bar text (e.g. `'Sunday, 18 October'`,
  `'Day 23, level 7'`). Wrap screen content in `<Page>` (gutter 24px, desktop max 760px) or `<Page wide>`.
- Phone first (390×844), then desktop (1280×800). The bottom nav is fixed; `Page` already pads for it.
  Nothing may overlap the bands. Avoid fixed heights for text; let content flow.
- Copy tone: direct, warm, numbers over adjectives, no exclamation marks, sentence case, no "!" in the UI.
  Empty states invite the next action ("Add your first routine") instead of describing absence.

## Testing

- Pure logic (parser, prompt builders, compiler, game math) gets Vitest tests beside the code (`*.test.ts`).
  Data-layer tests run against `fake-indexeddb` (already in `tests/setup.ts`); create a fresh
  `new ChronicleDB('test-' + Math.random())` per test or `resetAll()` in `beforeEach`.
- Component tests with Testing Library only where logic lives in the component (form validation, paste flow).
- `e2e/smoke.spec.ts` must keep passing: fresh install → onboarding, "Try the demo" → Morning shows Day 23,
  every main route renders. Add specs under `e2e/` for your flow if it is user-visible.

## Git

Work on your own branch in your own worktree. Commit in small steps with clear messages. Do not touch
`package.json` dependencies without noting it in your final report (prefer no new dependencies).

## Shared building blocks (use these, do not re-implement)

- `src/lib/parse/sections.ts` — `splitSections(md)`, `section(list, 'BRIEF')`, `bullets(body)`, `pairs(body)`,
  `num(text)`. Headers are normalised (`## Brief`, `**BRIEF**`, `BRIEF:` all → `BRIEF`; aliases like
  `LETTER` → `BRIEF`, `STATE OF ME` → `STATE_OF_ME`). Every parser is built on this.
- `src/lib/prompt/shared.ts` — `GAME_MASTER_PREAMBLE`, `VOICE_RULES`, `section(title, body)`, `joinBlocks`,
  `RULE`, `stripMoney(md)`, `estimateTokens`, `formatTokens`, `MODEL_LABEL`. Every prompt starts with the
  preamble and voice rules, then its own task and reply format, then `---`, then the data.
- `src/lib/clipboard.ts` — `copyText`, `readClipboard`, `openClaude`, `downloadText`.
- `src/ui/PromptHandoff.tsx` — the one hand-off UI: Copy prompt (walnut) · "For Haiku. About 9.2k tokens." ·
  Open Claude · Show text · dashed paste box · "Use this reply". Give it `promptMd`, `model`, and an
  `onReply(replyMd) → {ok, error?, message?}` that parses and saves. Nightly, origin, weekly, skill rank
  and lore all use it, so the loop feels identical everywhere.
- `DayLog` already has `closedAt`, `routineStats`, `statsAppliedAt` for the night flow (see types.ts comments).
- Repository writes are read-modify-write inside one Dexie transaction. `profileRepo.*` locks only the `profile`
  table so it can be nested inside a caller's transaction; the pillar rows are created outside the parent
  transaction when a profile is first made. When you open a transaction, list every table you touch.
