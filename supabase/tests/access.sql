-- Run in the Supabase SQL Editor after migration. Everything is rolled back.
begin;
do $$ begin
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('seasons','totals','media','site_settings') and c.relrowsecurity) <> 4 then
    raise exception 'RLS missing';
  end if;
  if has_table_privilege('anon','public.totals','UPDATE') or has_table_privilege('authenticated','public.totals','UPDATE') then raise exception 'Direct totals write privilege'; end if;
  if has_function_privilege('anon','public.save_totals(text,text,integer,integer,integer,integer)','EXECUTE') then raise exception 'Anonymous mutation privilege'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if public.is_admin() then raise exception 'Anonymous user is admin'; end if;
  begin
    perform public.save_totals('2026-2027','trident',0,0,0,0);
    raise exception 'Mutation unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.choose_hero('local-1');
    raise exception 'Hero mutation unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
