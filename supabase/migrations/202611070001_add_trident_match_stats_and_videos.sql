-- Run once on the Supabase project used by siteedward.
begin;

update public.totals t
set matches = t.matches + 1,
    goals = t.goals + 2,
    assists = t.assists + 1,
    revision = t.revision + 1
from public.seasons s
where s.id = t.season_id
  and s.active
  and t.team = 'trident';

alter table public.site_settings
  drop constraint if exists site_settings_hidden_local_media_check;
alter table public.site_settings
  add constraint site_settings_hidden_local_media_check
  check (hidden_local_media <@ array[
    'local-hero', 'local-1', 'local-2', 'local-3', 'local-4', 'local-5', 'local-6',
    'local-video-1', 'local-video-2', 'local-video-3',
    'local-video-4', 'local-video-5', 'local-video-6',
    'local-video-7', 'local-video-8', 'local-video-9'
  ]);

create or replace function public.remove_media(p_media text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_hero text;
begin
  if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  select coalesce(hero_media_id,'local-hero') into current_hero
    from public.site_settings where id=1 for update;
  if current_hero=p_media then
    raise exception 'Choisissez une autre photo d’accueil avant de retirer celle-ci.';
  end if;
  if p_media = any(array[
    'local-hero','local-1','local-2','local-3','local-4','local-5','local-6',
    'local-video-1','local-video-2','local-video-3',
    'local-video-4','local-video-5','local-video-6',
    'local-video-7','local-video-8','local-video-9'
  ]) then
    update public.site_settings
      set hidden_local_media=array(select distinct unnest(hidden_local_media || array[p_media]))
      where id=1;
  else
    delete from public.media where id=p_media;
    if not found then raise exception 'Unknown media'; end if;
  end if;
end; $$;

commit;
