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
3. If no IMDb value is available, do not show an IMDb score badge on the search tile.

Search sorting and filtering can still use TMDB `vote_average` because TMDB powers those APIs, but the visible score badge must not present that value as IMDb.

## Detail cards

Detail cards should show an IMDb badge only when an IMDb value is stored or fetched from OMDb. They should not fall back to TMDB `vote_average` under the IMDb label.
