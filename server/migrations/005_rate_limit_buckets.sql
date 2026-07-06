-- Agora distributed API rate-limit buckets.
--
-- The API can use this table through the service-role storage adapter when
-- AGORA_RATE_LIMIT_DRIVER=supabase. The RPC increments a workspace/key bucket
-- atomically so multiple API workers share the same counters.

create table if not exists public.agora_rate_limit_buckets (
  workspace_id text not null,
  bucket_key text not null,
  count integer not null default 0,
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, bucket_key)
);

create index if not exists idx_agora_rate_limit_buckets_reset
  on public.agora_rate_limit_buckets(reset_at);

drop trigger if exists trg_agora_rate_limit_buckets_updated_at on public.agora_rate_limit_buckets;
create trigger trg_agora_rate_limit_buckets_updated_at
before update on public.agora_rate_limit_buckets
for each row
execute function public.agora_set_updated_at();

create or replace function public.agora_increment_rate_limit(
  p_workspace_id text,
  p_key text,
  p_window_ms integer
)
returns table(count integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(secs => greatest(p_window_ms, 1000) / 1000.0);
begin
  delete from public.agora_rate_limit_buckets
  where reset_at <= v_now - interval '5 minutes';

  insert into public.agora_rate_limit_buckets(workspace_id, bucket_key, count, reset_at)
  values (p_workspace_id, left(p_key, 240), 1, v_now + v_window)
  on conflict (workspace_id, bucket_key) do update
  set
    count = case
      when public.agora_rate_limit_buckets.reset_at <= v_now then 1
      else public.agora_rate_limit_buckets.count + 1
    end,
    reset_at = case
      when public.agora_rate_limit_buckets.reset_at <= v_now then v_now + v_window
      else public.agora_rate_limit_buckets.reset_at
    end,
    updated_at = v_now
  returning public.agora_rate_limit_buckets.count, public.agora_rate_limit_buckets.reset_at
  into count, reset_at;

  return next;
end;
$$;

alter table public.agora_rate_limit_buckets enable row level security;

drop policy if exists agora_rate_limit_buckets_admin_read on public.agora_rate_limit_buckets;
create policy agora_rate_limit_buckets_admin_read
on public.agora_rate_limit_buckets
for select
to authenticated
using (public.agora_workspace_role(workspace_id) = 'admin');
