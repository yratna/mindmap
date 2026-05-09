-- Supabase SQL: run this in the SQL Editor at supabase.com/dashboard

-- Maps table
create table if not exists maps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Untitled Map',
  data jsonb not null default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Index for fast lookups by user
create index if not exists maps_user_id_idx on maps(user_id);

-- Row Level Security: users can only access their own maps
alter table maps enable row level security;

create policy "Users can read own maps"
  on maps for select
  using (auth.uid() = user_id);

create policy "Users can insert own maps"
  on maps for insert
  with check (auth.uid() = user_id);

create policy "Users can update own maps"
  on maps for update
  using (auth.uid() = user_id);

create policy "Users can delete own maps"
  on maps for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger maps_updated_at
  before update on maps
  for each row
  execute function update_updated_at();
