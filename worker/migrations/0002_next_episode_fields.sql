-- Add next episode tracking fields if they don't already exist.
-- SQLite does not support IF NOT EXISTS on ALTER TABLE, so run this once.
-- If the column already exists, this will error — ignore that error and move on.
ALTER TABLE series ADD COLUMN nextEpisodeDate TEXT;
ALTER TABLE series ADD COLUMN nextEpisodeName TEXT;
