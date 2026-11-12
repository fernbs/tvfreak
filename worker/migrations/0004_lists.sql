-- Listas propias de películas, compartidas con la tele (worker tvfreak-stremio).
-- Mismo esquema que crea ese worker, por eso IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS tv_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  privacy TEXT NOT NULL DEFAULT 'private',
  rank INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tv_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listId INTEGER NOT NULL,
  tmdbId INTEGER NOT NULL,
  imdbId TEXT,
  title TEXT NOT NULL,
  year INTEGER,
  posterPath TEXT,
  overview TEXT,
  rank INTEGER NOT NULL DEFAULT 0,
  listedAt TEXT NOT NULL,
  UNIQUE (listId, tmdbId)
);
