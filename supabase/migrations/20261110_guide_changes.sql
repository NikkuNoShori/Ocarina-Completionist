-- Public history of every change published to the shared guide, for the "Guide updates" page.
-- Exposes only what changed on which row and when: not who published it or from which save file.
-- Publishes that were undone are removed from the log by undo_publish, so they don't show here.

create or replace function public.guide_changes(p_limit integer default 500)
returns table (id bigint, at timestamptz, list_id text, n integer, before jsonb, changes jsonb)
language sql
stable
security definer
set search_path to ''
as $$
  select l.id, l.at, l.list_id, l.n, l.before, l.changes
  from private.items_publish_log l
  order by l.at desc, l.id desc
  limit least(greatest(coalesce(p_limit, 500), 1), 2000);
$$;

revoke all on function public.guide_changes(integer) from public;
grant execute on function public.guide_changes(integer) to anon, authenticated;
