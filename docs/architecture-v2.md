# Chronicle v2: the mind web, the day as it happens, and the morning review

This is the design for the "big update". Read it with `CLAUDE.md` (conventions) and `ARCHITECTURE.md` (the
original layout). Everything here is additive: schema 3 adds four tables, every other change is an optional
field or a new section in a prompt or reply.

## What the player experiences

1. **Open the app at any time, see now.** The Morning screen starts with a *Now strip*: the clock, what is on
   right now (a timetable class, a routine window, or a plan block Claude set), and what is next. `/now` is the
   whole day as a timeline. The timetable (`Vault → Timetable`) is a weekly grid with a one-tap preset for the
   player's university schedule (`src/data/timetablePresets.ts`).
2. **First thing in the morning: what went right, what to do better.** The nightly reply now carries
   `## RIGHT` and `## BETTER`, shown on Morning above the letter, plus the day's `## PLAN` (time blocks for
   the day, fitted around the timetable) and `## FOOD` notes.
3. **The day feeds the night.** Two capture boxes at the Campfire (and reachable any time): the **rant box**
   (`Note.kind = 'rant'`, answered by `## RANT` in the reply) and the **life feed** (`kind = 'life'`, timestamped
   lines about what is going on). Both go into the nightly prompt verbatim.
4. **Food, visually.** The Campfire's intake section shows calories, protein, carbs, fat, water, steps and sleep
   against the targets in `Settings.targets` as bars, with what went well and what could be better (computed in
   the app, with Claude's `## FOOD` lines once the reply lands).
5. **The mind web.** Every night Claude maintains a graph of the player's life: nodes (people, goals, routines,
   books, skills, places, topics, events, habits) with a running summary, dated facts and importance; edges with a
   relation in Claude's words. People Claude meets in the journal become `Person` rows automatically (`## PEOPLE`),
   each with a contact entry for the day. The web is browsable at `/web` and feeds back into every nightly prompt
   as a compact excerpt.
6. **Goals on the map with shields.** Map regions show goal progress and each routine's shield as a pixel
   shield; the map is where goals are added and reviewed.
7. **History is editable.** Any past day's log, meals and notes can be corrected (`/edit/day/:date`), and books
   can change status, so the record Claude reads stays true.

## Data (schema 3, `src/data/migrations.ts`)

| Table | Row | Who writes |
|---|---|---|
| `notes` | `Note { date, at, kind: 'rant' \| 'life', text }` | the capture boxes (`noteRepo`) |
| `timetable` | `TimetableEntry { day, start, end, title, kind, room?, teacher?, code?, from?, to? }` | the timetable editor (`timetableRepo`) |
| `webNodes` | `WebNode { type, label, refId?, summaryMd, facts[], firstSeen, lastSeen, mentions, importance }` | `webRepo.apply` from `## WEB` and `## PEOPLE` |
| `webEdges` | `WebEdge { from, to, relation, note?, weight, firstSeen, lastSeen }` | `webRepo.apply` |

Optional fields added: `Settings.targets`, `DayLog.review`, `DayLog.foodNotes`, `DayLog.rantReplyMd`,
`DayLog.plan` (see `types.ts`). All four tables are in `TABLE_NAMES`, so they back up and sync like the rest.

## The nightly prompt and reply (owned by the prompt/parse layer)

Prompt data gains, in this order after "Today at a glance": the day's notes (rants and life lines with times),
tomorrow's timetable, the targets and today's intake against them, and a **mind web excerpt** (the ~25 most
important or recently seen nodes with their summary and the edges between them, capped at ~2,500 tokens).
The nightly budget rises to 16k tokens (deep 40k) because Opus reads it.

New reply sections (all optional; older replies parse unchanged):

```
## RIGHT      - lines: what today did well, with the number or name that shows it
## BETTER     - lines: what to change tomorrow, concrete
## FOOD       - good: … / - better: … (intake against the targets)
## RANT       2-5 sentences answering the rant(s), in the game master's voice; "- None" without a rant
## PEOPLE     - Name | circle (family, close, friends, work, acquaintance) | one line of what the log said
## WEB        - node: Type | Label | fact for today   (Type: person, goal, routine, book, skill, place, topic, event, habit)
              - link: Label A -> Label B | relation | note
              - summary: Label | a one-line rewrite of that node's running summary
## PLAN       - 06:30-07:00 | text | Pillar   (tomorrow, 4-8 blocks, around the timetable and routine windows)
```

`## PEOPLE` upserts `Person` rows (match by name, case-insensitive; new people start as `acquaintance`,
closeness 2, contactEveryDays 14), adds a `Contact` for the day, and mirrors each as a `person` node with
`refId`. `## WEB` upserts nodes by (type, label), appends dated facts, raises `mentions`, bumps `lastSeen`,
and upserts edges by (from, to). Claude never deletes; the player can, at `/web`.

## Ownership during the build

Each area lives in its own folder so agents can work in parallel; shared files (`types.ts`, `db.ts`,
`repo.ts`, `primitives.tsx`, `sprites.ts`) are foundation and were prepared up front. New sprites and
primitives go in feature folders.
