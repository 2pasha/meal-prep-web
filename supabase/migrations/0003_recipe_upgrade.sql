-- Recipe upgrade: steps, source link, tags, and uploaded photos.
-- recipes.photo now holds either a bundled photo key or a Storage path ("<user_id>/<file>.jpg").

alter table recipes
  add column steps jsonb,                      -- {"uk": ["step 1", "step 2"]}
  add column source_url text,
  add column tags text[] not null default '{}';

-- Public bucket: photo URLs are unguessable (uuid file names) and cache well in the PWA.
-- Writes are limited to the user's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "list own recipe photos" on storage.objects for select to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "upload own recipe photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own recipe photos" on storage.objects for update to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own recipe photos" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Seed copy now carries the new columns too.
create or replace function init_user_data() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  already boolean;
  r record;
  new_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into public.profiles (id) values (uid) on conflict do nothing;
  select seeded into already from public.profiles where id = uid for update;
  if already then return; end if;

  for r in select * from public.recipes where user_id is null loop
    insert into public.recipes (user_id, name, description, meal_type, minutes, kcal, vegetarian, photo, steps, source_url, tags)
    values (uid, r.name, r.description, r.meal_type, r.minutes, r.kcal, r.vegetarian, r.photo, r.steps, r.source_url, r.tags)
    returning id into new_id;
    insert into public.recipe_ingredients (recipe_id, name, amount, unit, category, position)
    select new_id, name, amount, unit, category, position
    from public.recipe_ingredients where recipe_id = r.id;
  end loop;

  update public.profiles set seeded = true where id = uid;
end $$;
