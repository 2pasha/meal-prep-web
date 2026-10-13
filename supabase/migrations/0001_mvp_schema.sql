-- MVP schema: single user owns their data. Household sharing comes later
-- (add household_id columns + policies then).

create type meal_type as enum ('breakfast', 'lunch', 'dinner');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  locale text not null default 'uk' check (locale in ('uk', 'en')),
  persons int not null default 2 check (persons between 1 and 20),
  created_at timestamptz not null default now()
);

-- user_id is null for global seed recipes (read-only for everyone).
create table recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  seed_key text unique,
  name jsonb not null,            -- {"uk": "...", "en": "..."}
  description jsonb,
  meal_type meal_type not null,
  minutes int,
  kcal int,
  vegetarian boolean not null default false,
  photo text,                     -- key of a bundled photo or storage path
  created_at timestamptz not null default now()
);
create index on recipes (user_id);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes on delete cascade,
  name jsonb not null,
  amount numeric not null,
  unit text not null,
  category text not null default 'other',
  position int not null default 0
);
create index on recipe_ingredients (recipe_id);

create table favorites (
  user_id uuid not null references auth.users on delete cascade,
  recipe_id uuid not null references recipes on delete cascade,
  primary key (user_id, recipe_id)
);

create table plan_entries (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  date date not null,
  meal meal_type not null,
  recipe_id uuid not null references recipes on delete cascade,
  primary key (user_id, date, meal)
);

create table shopping_checks (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  week_start date not null,
  item_key text not null,
  primary key (user_id, week_start, item_key)
);

create table shopping_extras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  week_start date not null,
  name text not null,
  category text not null default 'other',
  checked boolean not null default false
);
create index on shopping_extras (user_id, week_start);

-- Row-level security
alter table profiles enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table favorites enable row level security;
alter table plan_entries enable row level security;
alter table shopping_checks enable row level security;
alter table shopping_extras enable row level security;

create policy "own profile" on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "read seeds and own recipes" on recipes for select to authenticated
  using (user_id is null or user_id = auth.uid());
create policy "write own recipes" on recipes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read ingredients of visible recipes" on recipe_ingredients for select to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_id and (r.user_id is null or r.user_id = auth.uid())));
create policy "write ingredients of own recipes" on recipe_ingredients for all to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()));

create policy "own favorites" on favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own plan" on plan_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own checks" on shopping_checks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own extras" on shopping_extras for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Create a profile automatically on first sign-in.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
