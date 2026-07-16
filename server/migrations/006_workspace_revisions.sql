-- Prevent concurrent API instances from silently overwriting workspace snapshots.

alter table public.agora_workspace_snapshots
  add column if not exists revision bigint not null default 0;

create or replace function public.agora_compare_and_swap_workspace_snapshot(
  p_workspace_id text,
  p_expected_revision bigint,
  p_snapshot jsonb,
  p_metadata jsonb
)
returns setof public.agora_workspace_snapshots
language plpgsql
as $$
declare
  saved public.agora_workspace_snapshots%rowtype;
begin
  if p_expected_revision = 0 then
    insert into public.agora_workspace_snapshots (workspace_id, snapshot, metadata, revision)
    values (p_workspace_id, p_snapshot, p_metadata, 1)
    on conflict (workspace_id) do nothing
    returning * into saved;
  else
    update public.agora_workspace_snapshots
    set snapshot = p_snapshot,
        metadata = p_metadata,
        revision = revision + 1
    where workspace_id = p_workspace_id
      and revision = p_expected_revision
    returning * into saved;
  end if;

  if saved.workspace_id is not null then
    return next saved;
  end if;
end;
$$;

revoke all on function public.agora_compare_and_swap_workspace_snapshot(text, bigint, jsonb, jsonb) from public;
grant execute on function public.agora_compare_and_swap_workspace_snapshot(text, bigint, jsonb, jsonb) to service_role;
