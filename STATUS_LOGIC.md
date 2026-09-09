# TVFREAK Status Logic

Last updated: 2026-09-09

## Stored statuses

| Status | Label | Meaning |
|---|---|---|
| `watching` | Watching | There is released, unwatched TV content for the user to watch. Newly added released series also start here. |
| `plantowatch` | Pending | The user is caught up, or the title has not released yet, and more content is expected. This is the stored value for the Pending label. |
| `completed` | Completed | The user is caught up and TMDB says the series has ended or was cancelled. For movies, this means watched. |
| `dropped` | Dropped | The user stopped watching. Automatic jobs never change this status. |

Movies currently use `completed`, `plantowatch`, and `dropped`. A released `plantowatch` movie appears in the Watching Now section until the user manually marks it watched.

## Core TV rule

For every non-dropped series, the app derives the automatic status from TMDB release state plus the user's watched episodes:

1. If no regular episodes have aired yet, status is `plantowatch`.
2. If at least one aired regular episode is unwatched, status is `watching`.
3. If all aired regular episodes are watched and TMDB says more content is expected, status is `plantowatch`.
4. If all aired regular episodes are watched and TMDB says the show is ended or cancelled, status is `completed`.

More content is expected when TMDB has `next_episode_to_air`, reports `Returning Series` or `In Production`, or exposes future season or episode dates. If future content has a date, the app stores it in `nextEpisodeDate` and/or `futureDates`. If future content is announced without a date, the series still stays `plantowatch` and uses the existing "New episodes coming soon" banner.

## User-triggered transitions

Adding a released series from Search, Discover, recommendations, or the detail panel sets it to `watching`.

Adding an unreleased series sets it to `plantowatch`.

Marking or unmarking episodes immediately recalculates the series:

1. When a pending series gets a newly released unwatched episode, marking that episode can briefly promote it to `watching`.
2. If that mark completes all currently released episodes, the recalculation immediately moves it back to `plantowatch` when more content is expected, or to `completed` when the show has ended or was cancelled.
3. Unmarking an episode on a completed or pending series moves it to `watching`, because released content is now unwatched.

Manual status changes from the detail menu are still allowed, but later automatic recalculation can correct any non-dropped series when release and watched state prove the next status.

## Background transitions

On app load, `refreshNextEpisodeDates` updates next episode dates, future dates, and ratings for active series.

Daily, `checkWatchingStatus` recalculates every `watching` and `plantowatch` series so existing library items cannot stay stuck in the wrong active status. This job is allowed to:

- Move `watching` to `plantowatch` when all aired episodes are watched and more content is expected.
- Move `watching` to `completed` when all aired episodes are watched and TMDB says the show has ended or was cancelled.
- Move `plantowatch` to `watching` on the day a new episode becomes released.
- Keep unreleased series in `plantowatch`.

Daily, `checkRevived` checks completed series. If TMDB says new content is coming, it moves the series to `plantowatch` and stores any known next episode date so the existing banners and Upcoming view can show it.

Dropped series are excluded from all automatic jobs.

## Banners

The existing pending banners are reused:

- Pending with a known `nextEpisodeDate`: show the dated new episode banner.
- Pending with expected content but no known date: show the "New episodes coming soon" banner.
- Completed and no future content: show the completed banner.

Future or TBA seasons remain visible in the episode list. If TMDB gives episode dates, those dates appear on the season and episode rows. If dates are unknown but TMDB still indicates the series is continuing, the title remains Pending.

## Episode counts

Automatic TV status checks count only regular seasons (`season_number > 0`).

For the active season, use `last_episode_to_air.episode_number` as the released count so unaired episodes listed by TMDB do not block catch-up detection.

For older aired seasons, use TMDB `season.episode_count`.

For open season views, episode-level `air_date` is used when available so same-day releases count as released and future episodes stay locked.

## Existing data repair

The daily status recalculation intentionally uses a new migration key when the status logic changes. That forces one fresh pass over existing saved `watching` and `plantowatch` series after deployment, fixing seasons that were already watched but remained stuck as `watching`.

Historical one-off migration keys stay marked as complete so older import repair jobs do not re-run.
