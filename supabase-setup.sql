-- Hermione Library: Comments table + RLS

-- 1. Comments table
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  article_slug text not null,
  user_id uuid references auth.users(id) on delete cascade,
  user_name text not null,
  user_avatar text,
  content text not null,
  created_at timestamptz default now()
);

-- 2. Enable RLS
alter table public.comments enable row level security;

-- 3. Anyone can read comments
create policy "Anyone can read comments"
  on public.comments for select
  using (true);

-- 4. Authenticated users can insert their own comments
create policy "Authenticated users can insert comments"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 5. Users can delete their own comments
create policy "Users can delete own comments"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- 6. Index for fast article lookup
create index if not exists idx_comments_slug on public.comments(article_slug, created_at);
