-- MyCar blog: add category, tags and SEO fields.
-- Safe to re-run. Existing posts keep working (all new columns are nullable
-- or defaulted).

alter table public.blog_posts
  add column if not exists category text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists seo_title text,
  add column if not exists meta_description text;
