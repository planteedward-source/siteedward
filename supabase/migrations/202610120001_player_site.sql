-- Execute once in the SQL editor of the Supabase project dedicated to siteedward.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.site_admins (user_id uuid primary key references auth.users(id) on delete cascade);
revoke all on private.site_admins from public, anon, authenticated;
alter table private.site_admins enable row level security;

create function public.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$ select exists(select 1 from private.site_admins where user_id = (select auth.uid())); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table public.seasons (
  id text primary key,
  label text unique not null check(label ~ '^20[0-9]{2}-20[0-9]{2}$' and right(label,4)::int = left(label,4)::int + 1),
  active boolean not null default false,
  check(id = label)
);
create unique index one_active_season on public.seasons(active) where active;
create table public.totals (
  season_id text references public.seasons(id) on delete cascade,
  team text check(team in ('trident','jm')),
  matches integer not null default 0 check(matches between 0 and 10000),
  goals integer not null default 0 check(goals between 0 and 10000),
  assists integer not null default 0 check(assists between 0 and 10000),
  revision integer not null default 0,
  primary key (season_id, team)
);
create table public.media (
  id text primary key default gen_random_uuid()::text,
  kind text not null check(kind in ('image','video')),
  path text unique not null,
  title text not null check(length(trim(title)) between 1 and 120),
  alt text not null check(length(trim(alt)) between 1 and 500),
  created_at timestamptz not null default now()
);
create table public.site_settings (
  id integer primary key check(id = 1),
  hero_media_id text,
  hidden_local_media text[] not null default '{}',
  check(hidden_local_media <@ array['local-hero','local-1','local-2','local-3','local-4','local-5'])
);
alter table public.seasons enable row level security;
alter table public.totals enable row level security;
alter table public.media enable row level security;
alter table public.site_settings enable row level security;
-- Public reads only. No direct browser writes, including for administrators.
revoke all on public.seasons, public.totals, public.media, public.site_settings from anon, authenticated;
grant select on public.seasons, public.totals, public.media, public.site_settings to anon, authenticated;
grant select, insert, delete on public.media to service_role;
create policy seasons_public_read on public.seasons for select to anon, authenticated using (true);
create policy totals_public_read on public.totals for select to anon, authenticated using (true);
create policy media_public_read on public.media for select to anon, authenticated using (true);
create policy settings_public_read on public.site_settings for select to anon, authenticated using (true);

insert into public.seasons(id,label,active) values ('2026-2027','2026-2027',true);
insert into public.totals(season_id,team) values ('2026-2027','trident'),('2026-2027','jm');
insert into public.site_settings(id) values (1);

create function public.save_totals(p_season text, p_team text, p_matches integer, p_goals integer, p_assists integer, p_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  update public.totals set matches=p_matches,goals=p_goals,assists=p_assists,revision=revision+1
  where season_id=p_season and team=p_team and revision=p_revision;
  if not found then raise exception 'conflict: reload totals'; end if;
end; $$;

create function public.create_season(p_label text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  insert into public.seasons(id,label) values(p_label,p_label);
  insert into public.totals(season_id,team) values(p_label,'trident'),(p_label,'jm');
end; $$;

create function public.activate_season(p_season text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(770040);
  if not exists(select 1 from public.seasons where id=p_season) then raise exception 'Unknown season'; end if;
  update public.seasons set active=false where active;
  update public.seasons set active=true where id=p_season;
end; $$;

create function public.delete_season(p_season text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(770040);
  if exists(select 1 from public.seasons where id=p_season and active) then raise exception 'La saison active ne peut pas être supprimée.'; end if;
  delete from public.seasons where id=p_season;
  if not found then raise exception 'Unknown season'; end if;
end; $$;

create function public.choose_hero(p_media text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform 1 from public.site_settings where id=1 for update;
  if not (p_media = any(array['local-hero','local-1','local-2','local-3','local-4','local-5'])) and
    not exists(select 1 from public.media where id=p_media and kind='image') then raise exception 'Choisissez une photo existante.'; end if;
  update public.site_settings set hero_media_id=p_media,hidden_local_media=array_remove(hidden_local_media,p_media) where id=1;
end; $$;

create function public.remove_media(p_media text) returns void language plpgsql security definer set search_path = '' as $$
declare current_hero text;
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  select coalesce(hero_media_id,'local-hero') into current_hero from public.site_settings where id=1 for update;
  if current_hero=p_media then raise exception 'Choisissez une autre photo d’accueil avant de retirer celle-ci.'; end if;
  if p_media = any(array['local-hero','local-1','local-2','local-3','local-4','local-5']) then
    update public.site_settings set hidden_local_media=array(select distinct unnest(hidden_local_media || array[p_media])) where id=1;
  else
    delete from public.media where id=p_media;
    if not found then raise exception 'Unknown media'; end if;
  end if;
end; $$;

create function public.restore_local_media() returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  update public.site_settings set hidden_local_media='{}' where id=1;
end; $$;

revoke all on function public.save_totals(text,text,integer,integer,integer,integer), public.create_season(text), public.activate_season(text), public.delete_season(text), public.choose_hero(text), public.remove_media(text), public.restore_local_media() from public, anon;
grant execute on function public.save_totals(text,text,integer,integer,integer,integer), public.create_season(text), public.activate_season(text), public.delete_season(text), public.choose_hero(text), public.remove_media(text), public.restore_local_media() to authenticated;

-- Only the validated Edge Function can upload. The browser has no storage write policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('player-media','player-media',true,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
create policy player_media_read on storage.objects for select to anon, authenticated using(bucket_id='player-media');
commit;
