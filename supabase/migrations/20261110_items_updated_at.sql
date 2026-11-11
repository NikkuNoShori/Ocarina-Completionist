-- When a shared checklist row last changed, so players who edited that row can be told
-- an admin has since updated it (and compare their version with the new one).

alter table public.items add column if not exists updated_at timestamptz;

-- Backfill from earlier publishes. Rows never published stay null ("unchanged since launch").
update public.items i
set updated_at = l.last_at
from (
  select list_id, n, max(at) as last_at
  from private.items_publish_log
  group by list_id, n
) l
where l.list_id = i.list_id and l.n = i.n;

-- Any change to what players see on a row (publish, undo, or a direct edit) stamps it.
create or replace function private.items_touch()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if (new.area, new.location, new.map_level, new.age, new.time_of_day, new.notes, new.adult_first)
     is distinct from
     (old.area, old.location, old.map_level, old.age, old.time_of_day, old.notes, old.adult_first) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists items_touch on public.items;
create trigger items_touch
  before update on public.items
  for each row execute function private.items_touch();
