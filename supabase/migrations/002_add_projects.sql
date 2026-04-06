-- ─── FA Platform — Migration 002: Projects ───────────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run All
-- Requires: 001_initial_schema.sql already applied
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Projects table ────────────────────────────────────────────────────────────
-- Central entity of the product. Every analysis belongs to a project.

create table if not exists public.projects (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users (id) on delete cascade not null,

  name        text        not null,
  description text,

  -- Context type for the project
  type        text        not null default 'outro'
                          check (type in ('pessoal', 'empresarial', 'cliente', 'contabilidade', 'outro')),

  -- Visual identity (stored as string keys, resolved client-side)
  color       text        not null default 'blue',    -- blue | violet | emerald | amber | rose | slate
  icon        text        not null default 'FolderOpen', -- Lucide icon name

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Link analyses to projects ─────────────────────────────────────────────────
-- Nullable so that analyses uploaded before projects existed still work.

alter table public.analyses
  add column if not exists project_id uuid references public.projects (id) on delete set null;

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists projects_user_id_idx
  on public.projects (user_id, created_at desc);

create index if not exists analyses_project_id_idx
  on public.analyses (project_id, created_at desc);

-- ── Auto-update updated_at on projects ────────────────────────────────────────

create or replace function public.touch_project_updated_at()
returns trigger as $$
begin
  -- When an analysis is inserted/updated with a project_id, bump the project's
  -- updated_at so "last activity" reflects the latest file upload.
  if new.project_id is not null then
    update public.projects
      set updated_at = now()
      where id = new.project_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists analyses_touch_project on public.analyses;
create trigger analyses_touch_project
  after insert or update of project_id on public.analyses
  for each row execute function public.touch_project_updated_at();
