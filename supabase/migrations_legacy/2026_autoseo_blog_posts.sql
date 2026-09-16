-- AutoSEO article store. Additive only: creates a new table, never touches
-- existing tables, columns, data or policies.
-- Run this once in the SQL editor of project rpmmlzyeqpvczuuobddt.

CREATE TABLE IF NOT EXISTS mycarco_db.blog_posts (
  id                integer PRIMARY KEY,
  title             text NOT NULL,
  slug              text NOT NULL UNIQUE,
  content_html      text,
  content_markdown  text,
  hero_image_url    text,
  hero_image_alt    text,
  infographic_url   text,
  meta_description  text,
  meta_keywords     text,
  tags              text,
  faq_schema        jsonb,
  language          text DEFAULT 'en',
  reading_time      integer,
  published_at      timestamptz,
  updated_at        timestamptz,
  created_at        timestamptz,
  received_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_posts_slug_idx ON mycarco_db.blog_posts (slug);
CREATE INDEX IF NOT EXISTS blog_posts_published_at_idx ON mycarco_db.blog_posts (published_at DESC);

GRANT SELECT ON mycarco_db.blog_posts TO anon, authenticated;
GRANT ALL ON mycarco_db.blog_posts TO service_role;

ALTER TABLE mycarco_db.blog_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'mycarco_db' AND tablename = 'blog_posts'
      AND policyname = 'autoseo posts are public'
  ) THEN
    CREATE POLICY "autoseo posts are public"
      ON mycarco_db.blog_posts FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'mycarco_db' AND tablename = 'blog_posts'
      AND policyname = 'service role writes autoseo posts'
  ) THEN
    CREATE POLICY "service role writes autoseo posts"
      ON mycarco_db.blog_posts FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
