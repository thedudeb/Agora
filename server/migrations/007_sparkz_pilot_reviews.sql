-- First-class, project-scoped Sparkz pilot reviews.

create table if not exists public.agora_sparkz_pilot_reviews
  (like public.agora_companies including all);

alter table public.agora_sparkz_pilot_reviews
  alter column collection_key set default 'sparkzPilotReviews';

create index if not exists idx_agora_sparkz_pilot_reviews_project
  on public.agora_sparkz_pilot_reviews(workspace_id, project_id, updated_at desc);

drop trigger if exists trg_agora_sparkz_pilot_reviews_updated_at
  on public.agora_sparkz_pilot_reviews;
create trigger trg_agora_sparkz_pilot_reviews_updated_at
  before update on public.agora_sparkz_pilot_reviews
  for each row execute function public.agora_set_updated_at();

alter table public.agora_sparkz_pilot_reviews enable row level security;

drop policy if exists agora_sparkz_pilot_reviews_member_read
  on public.agora_sparkz_pilot_reviews;
create policy agora_sparkz_pilot_reviews_member_read
  on public.agora_sparkz_pilot_reviews
  for select to authenticated
  using (public.agora_can_read_record(workspace_id, company_id));

drop policy if exists agora_sparkz_pilot_reviews_manager_write
  on public.agora_sparkz_pilot_reviews;
create policy agora_sparkz_pilot_reviews_manager_write
  on public.agora_sparkz_pilot_reviews
  for all to authenticated
  using (public.agora_can_write_team_record(workspace_id))
  with check (public.agora_can_write_team_record(workspace_id));
