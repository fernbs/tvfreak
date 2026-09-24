# TVFREAK Rating Display Spec

Last updated: 2026-09-14

## Rating sources

- IMDb ratings come from OMDb via a TMDB external IMDb ID.
- Rotten Tomatoes and Metacritic ratings also come from OMDb.
- TMDB `vote_average` is not an IMDb rating and must not be shown inside an IMDb badge or stored as `imdbRating`.

## Search tiles

Search result tiles should show the same IMDb rating source used by the detail card:

1. Use any IMDb rating already stored for the matching library item as an immediate placeholder.
2. For visible search results, fetch the TMDB external ID and OMDb ratings, then replace the placeholder with the OMDb IMDb value when available.
3. The fetch should cover all currently loaded search results, not just the first row or first few tiles.
4. If no IMDb value is available, do not show an IMDb score badge on the search tile.

Search sorting and filtering can still use TMDB `vote_average` because TMDB powers those APIs, but the visible score badge must not present that value as IMDb.

## Detail cards

Detail cards should show an IMDb badge only when an IMDb value is stored or fetched from OMDb. They should not fall back to TMDB `vote_average` under the IMDb label.

## Movie tiles

Movie tiles in Watching and Library should show IMDb and Rotten Tomatoes chips whenever OMDb provides those values. This applies to poster grids and list rows, not only to the movie detail card.

1. Movie create and batch-import endpoints must persist both `imdbRating` and `rtRating` when supplied.
2. The app must fetch OMDb ratings for saved movies missing either value, including films that already contain an older placeholder IMDb score.
3. A completed backfill must not prevent newly added unrated movies from being populated on a later launch.
4. If a source has no rating, omit only that source's chip.
