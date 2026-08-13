CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdbId INTEGER,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'plantowatch',
  posterPath TEXT,
  overview TEXT,
  firstAirDate TEXT,
  lastAirDate TEXT,
  numberOfSeasons INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  addedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watchedEpisodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seriesId INTEGER NOT NULL,
  seasonNumber INTEGER NOT NULL,
  episodeNumber INTEGER NOT NULL,
  watchedAt TEXT NOT NULL,
  UNIQUE(seriesId, seasonNumber, episodeNumber)
);

CREATE INDEX IF NOT EXISTS idx_series_title ON series(title);
CREATE INDEX IF NOT EXISTS idx_watched_seriesId ON watchedEpisodes(seriesId);
