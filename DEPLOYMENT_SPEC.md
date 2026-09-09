# TVFREAK Deployment Spec

## Production instance

- Branch: `main`
- Frontend path: `/tvfreak/`
- Worker: `tvfreak-worker`
- D1 database: `tvfreak`
- Purpose: Fernando's personal TVFREAK library.

## Alfon instance

- Branch: `alfon`
- Frontend path: `/tvfreak/alfon/`
- Worker: `tvfreak-alfon-worker`
- D1 database: `tvfreak-alfon`
- Purpose: Alfon's separate TVFREAK library.

The Alfon instance must not share Fernando's Worker or D1 database. It starts with an empty library and must not auto-import Fernando's old series or movie history.
