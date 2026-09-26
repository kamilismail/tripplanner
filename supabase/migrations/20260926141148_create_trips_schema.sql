-- Create trips and trip_points tables with per-user row level security.
--
-- trip_points denormalizes user_id (rather than requiring every RLS policy to
-- join back to trips) so ownership checks stay a flat `auth.uid() = user_id`
-- predicate. A trigger keeps trip_points.user_id in sync with its parent
-- trip's owner regardless of what a caller passes, so it can never drift.

create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  city text not null,
  day_count integer not null check (day_count > 0),
  created_at timestamptz not null default now()
);

create index trips_user_id_idx on trips (user_id);

create table trip_points (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_number integer not null check (day_number > 0),
  order_index integer not null default 0,
  name text not null,
  description text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  created_at timestamptz not null default now()
);

create index trip_points_trip_id_idx on trip_points (trip_id);
create index trip_points_user_id_idx on trip_points (user_id);

-- Keep trip_points.user_id authoritative: always derive it from the parent
-- trip rather than trusting the caller-supplied value.
create function set_trip_points_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select user_id into new.user_id from public.trips where id = new.trip_id;
  return new;
end;
$$;

create trigger trip_points_sync_user_id
  before insert or update on trip_points
  for each row
  execute function set_trip_points_user_id();

alter table trips enable row level security;
alter table trip_points enable row level security;

create policy "trips_select_own" on trips
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "trips_insert_own" on trips
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "trips_update_own" on trips
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trips_delete_own" on trips
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "trip_points_select_own" on trip_points
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "trip_points_insert_own" on trip_points
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "trip_points_update_own" on trip_points
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trip_points_delete_own" on trip_points
  for delete
  to authenticated
  using (auth.uid() = user_id);
