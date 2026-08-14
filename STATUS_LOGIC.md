# TVFREAK — Status Logic

Last updated: 2026-08-14

---

## The four statuses

| Status | Label | Meaning |
|---|---|---|
| `watching` | Watching | I'm actively following this show. May be mid-season, caught up, or waiting for next episode. |
| `plantowatch` | Pending | I haven't started watching yet. Show has aired or is upcoming. |
| `completed` | Completed | I'm done with this show as far as I'm concerned. May still be airing — that's my choice. |
| `dropped` | Dropped | I stopped watching and don't want the app to touch this. Sacred — no job ever changes it automatically. |

---

## How status changes

### User-initiated (always takes priority)

- Tapping ⋯ → "Change status" in DetailPanel sets any status to any other. This is the only source of truth the user controls directly.
- Adding a series from Search always sets it to `watching`.

### Automatic — triggered by episode marking

These fire in EpisodeList when the user marks or unmarks episodes.

**Mark: all aired episodes watched (`handleAllEpisodesWatched` in DetailPanel)**

Fires when `watched.size >= releasedEpisodeCount()` after a mark action.

Only acts when current status is `watching`. Guards prevent it from running if status is `completed`, `dropped`, or `plantowatch`. (Those series show the episode list but marking all episodes won't auto-change their status.)

- If TMDB says the show is ongoing (`Returning Series` or `In Production`, or has a `next_episode_to_air`) → status stays `watching`, toast "all caught up."
- If TMDB says the show has ended → status → `completed`.

**Unmark: any episode unchecked (`handleSomeEpisodesUnwatched` in DetailPanel)**

Fires on any uncheck (individual episode or whole season). The callback fires regardless of status, but the function itself only acts when status is `completed`.

- If status is `completed` → status → `watching`.
- All other statuses → no change (function returns early).

---

### Automatic — background jobs

These run in the background on app load. They never touch `dropped` series.

#### 1. `refreshNextEpisodeDates` — on every app load (conditional)

Scope: `watching` and `plantowatch` series where `nextEpisodeDate` is missing or in the past. Series with a valid future `nextEpisodeDate` are skipped.

What it does: fetches TMDB data to update `nextEpisodeDate`, `nextEpisodeName`, `futureDates`, and `imdbRating`. Does NOT change status.

Side effect: calls `updateSeries` on qualifying series, which bumps `updatedAt`. This is why Watching Now reorders across sessions — any show whose next episode date has passed gets a fresh TMDB call and `updatedAt` bump. Known issue — planned fix: sort Watching Now by `nextEpisodeDate` instead of `updatedAt`.

#### 2. `checkWatchingStatus` — daily

Scope: `watching` series only.

What it does: fetches watched episodes from DB and TMDB season data. If all aired episodes are watched:

- Has `next_episode_to_air` → keeps `watching`, updates next episode date, toasts.
- TMDB status is `Returning Series` or `In Production` (but no specific next episode yet) → keeps `watching`, clears next episode date, toasts.
- Show has ended (none of the above) → sets `completed`, toasts.

Known limitation: uses `season.episode_count` from TMDB for the total, not actual released episode count. TMDB sometimes lists episodes for a season before they all air, so the threshold might be slightly higher than reality mid-season. Acceptable for a daily background check.

#### 3. `checkRevived` — daily

Scope: `completed` series only.

What it does: checks TMDB for shows that have new episodes announced.

- Has `next_episode_to_air` → updates `nextEpisodeDate` in DB (so it shows in Upcoming), toasts "show is back."
- TMDB status is `Returning Series` or `In Production` → toasts only, no DB change.

Does NOT change status. Fernando decides whether to move a completed show back to watching via the ⋯ menu.

#### 4. `cleanupUnreleasedWatched` — once per session

Scope: all series.

What it does: removes watched episode marks for seasons that haven't aired yet (safety net for accidentally marked future seasons). No status change.

#### 5. `populateRatings` — once-ever (key: `tvfreak-ratings-populated-v1`)

Scope: `completed` and `dropped` series without a rating.

What it does: fetches TMDB vote average and saves it. No status change.

---

### Dead jobs — do not modify

These ran once during the Simkl import migration. Their localStorage keys are permanently set on all devices. Changing the logic or key would cause them to re-run.

| Job | Key | What it did | Why it's dead |
|---|---|---|---|
| `fixCompletedReturning` | `tvfreak-fix-completed-v1` | Changed `completed` + TMDB returning → `watching` | Too broad — changed shows Fernando was done with (Fargo, Black Mirror, etc.) |
| `fixPendingToWatching` v1 | `tvfreak-watching-fix-v1` | Changed `plantowatch` + aired → `watching` | Caught shows that Simkl exported as plantowatch that Fernando considered dropped |
| `fixPendingToWatching` v2 | `tvfreak-watching-fix-v2` | Same as v1, for series missed because `firstAirDate` wasn't populated yet | Completed its purpose |

---

## Invariants (rules that must always hold)

1. `dropped` is never changed automatically by any job or trigger. Ever.
2. `completed` is only changed automatically when the user unmarks an episode (→ `watching`). Background jobs notify but do not change it.
3. `watching` → `completed` only happens via `handleAllEpisodesWatched` or `checkWatchingStatus`, and only when TMDB confirms the show has ended. Both use `season.episode_count` for the threshold, which may be slightly imprecise mid-season.
4. Adding a series always starts it as `watching`.
5. Episode marking only auto-changes status when current status is `watching`. The `plantowatch`, `completed`, and `dropped` guards in `handleAllEpisodesWatched` prevent any accidental auto-transition for those states. Unchecking only affects `completed` series (reverts to `watching`).

---

## Known issues and design debt

**No memory of original import status**
The Simkl import ran once. Some shows imported as `completed` were changed to `watching` by the dead migration jobs. There is no record of original intent, so manually dropped/completed shows had to be reset by hand. Future imports should preserve source status more carefully. This is a historical issue with no code fix available.

## Fixed issues

**`updatedAt` used for sort order in Watching Now** (fixed 2026-08-14)
Background jobs touched `updatedAt` when updating metadata, causing the order to shift across sessions. Fixed: Watching Now now sorts by `nextEpisodeDate` ascending (soonest first), with no-date shows last and alphabetical tiebreak.

**`checkWatchingStatus` episode count accuracy** (fixed 2026-08-14)
Previously used `season.episode_count` from TMDB, which includes unaired episodes in the currently-airing season. Fixed: for the season matching `last_episode_to_air.season_number`, uses `last_episode_to_air.episode_number` as the released count instead. Completed seasons still use `episode_count` (which is accurate once a season is done).
