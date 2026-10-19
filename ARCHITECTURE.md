# Architecture

## Principles

1. **Local first.** IndexedDB (Dexie) is the source of truth. Every row has `id`, `createdAt`, `updatedAt` so
   a sync layer (SQLite + PowerSync, or Supabase) can be added without touching screens.
2. **The player owns the loop.** No API keys are needed. The app writes prompts; the player carries them to
   Claude and back. An optional API key path exists in Settings for one-tap nights.
3. **Pure logic is pure.** Parsers, prompt builders, the Origin Sheet compiler and the game math are plain
   functions with unit tests. Screens are thin.
4. **One design system.** Paper tokens, `SectionHeader` + `Section` structure, pixel sprites from string maps.
   No cards, no shadows, no rounded corners, red only for signals.

## Layers

```
src/app        HashRouter, Shell (ink top bar, bottom nav, desktop rail), RequireOnboarded, shell context
src/theme      tokens.css — Tailwind v4 @theme tokens, base styles, .letter prose
src/ui         primitives (SectionHeader, Bar, StatRow, Button, Chip, Field…), icons, PixelSprite, sprites,
               PromptHandoff (copy prompt → open Claude → paste reply)
src/data       types.ts (entities), db.ts (Dexie schema v1), repo.ts (repositories, backup, reset),
               hooks.ts (useLiveQuery hooks), seed.ts (demo world + DEMO_REPLY_MD)
src/lib        dates (day keys, 4 AM rollover), clipboard, game/ (level curve, daily delta, streaks, apply),
               prompt/ (shared preamble, nightly, weekly, deep, origin, skill, lore), parse/ (sections,
               reply, weekly, origin, skill, lore), compile/ (originSheet)
src/features   morning, campfire, you, map, people, vault, onboarding, editors — one folder per screen
```

## Data model

Dexie tables (see `src/data/db.ts`): `profile` (one row: name, settings, Origin Sheet, State of Me,
onboarding progress), `pillarState`, `subStatState`, `routines`, `routineLogs`, `goals`, `milestones`,
`visionItems`, `dayLogs` (one per day key, holds both what the player logged and the parsed reply),
`affirmations` (kept ones), `foods`, `meals`, `skills`, `achievements`, `assessments`, `people`, `contacts`,
`books`, `lessons`, `lore`, `prompts` (every prompt and its reply: the training set), `digests`.

### Points and levels

Sub-stats hold points. A pillar's points are the mean of its four sub-stats. Level = `10 × log2(1 + points/50)`,
one decimal, no cap. The player's level uses the same curve over the mean of the five pillars.

Each night the app computes **routine deltas** (Σ weights done − 0.5 × Σ weights skipped, floored at −5 per
pillar) and applies them when the log is sent. Claude's `## STATS` lines are judgment adjustments on top
(−3…+3 per pillar, optional sub-stat lines, skill re-rankings as `Name A -> B`). Both are stored on the
`DayLog` (`routineStats`, `stats`) with `statsAppliedAt`, so a re-pasted reply reverts and re-applies cleanly.

### Streaks and shields

Streaks are derived from logs (consecutive scheduled days done). Each routine gets one shield a week; a shield
silently covers one miss. After that a miss breaks the streak and produces a warning, never a penalty beyond
the −0.5 × weight.

## The loop

```
Campfire ─ gather ─▶ buildNightlyPrompt ─▶ clipboard ─▶ Claude ─▶ clipboard ─▶ parseNightlyReply ─▶ DayLog
                                                                              ├─▶ applyNightStats
                                                                              └─▶ prompts (dataset)
```

Prompt layers: game-master preamble and voice → task and exact reply format → `---` → State of Me →
goals, quiet people, books and lessons, skills → month digests → last 14 compressed days → tonight in full.
Deep mode adds the last 90 days and the Origin Sheet. `excludeMoney` strips money lines.

Other prompts share the preamble: **origin** (Origin Sheet → State of Me, skills, routines, goals, first
letter), **weekly** (digest + State of Me rewrite), **monthly** (digest), **skill rank** (ASSESSMENT /
NEXT_MILESTONES), **lore** (free text about an item → FACTS / ACHIEVEMENTS / LESSONS / UPDATES / REPLY).

All parsers are built on `src/lib/parse/sections.ts`, which splits tagged markdown on `## HEADER` lines and
tolerates the ways Claude tends to write headers. A nightly reply without `## BRIEF` is rejected and kept as a
raw draft so nothing is lost.

## Routing

HashRouter, so the build runs from any static path. `/onboarding/*` is outside the shell. Inside it:
`/` Morning, `/campfire`, `/you`, `/map`, `/people`, `/vault/*`, `/edit/*` (routines, goals, skills, people,
books, vision).

## Testing

- Vitest with jsdom and `fake-indexeddb`: unit tests beside the code, data-layer tests in `tests/`.
- Playwright: `e2e/smoke.spec.ts` plus one spec per feature; two projects, phone 390×844 and desktop 1280×800.
  Screenshots are written to `e2e/output/` and compared by eye against the design canvas.

## Later phases

Sync (Supabase or PowerSync mirroring the same tables), progress photos (OPFS + encrypted sync), money,
Apple Health / Health Connect via Capacitor, wardrobe on the character, notifications, and a local model
fine-tuned on `prompts` (exported as JSONL from the Vault) to replace the paste loop.
