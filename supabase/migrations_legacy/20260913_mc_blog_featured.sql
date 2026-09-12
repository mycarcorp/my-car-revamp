-- Add a single featured-post flag to the legacy blog table.
ALTER TABLE mycarco_db.mc_blog
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS mc_blog_featured_published_idx
  ON mycarco_db.mc_blog (is_featured, published_at DESC);

NOTIFY pgrst, 'reload schema';