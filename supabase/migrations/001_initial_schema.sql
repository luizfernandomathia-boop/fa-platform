-- ─── FA Platform — Initial Schema ────────────────────────────────────────────
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run All
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Profiles ─────────────────────────────────────────────────────────────────
-- Extends auth.users with app-specific fields.
-- Auto-created via trigger when a new user signs up.

create table if not exists public.profiles (
  id              uuid        references auth.users (id) on delete cascade primary key,
  email           text        not null,
  full_name       text,
  avatar_url      text,

  -- ── Future monetization (ready to wire up, not enforced yet) ──────────────
  plan            text        not null default 'free',   -- 'free' | 'pro' | 'enterprise'
  plan_expires_at timestamptz,
  monthly_limit   int         not null default 50,       -- max analyses / month
  monthly_used    int         not null default 0,        -- reset each month
  total_analyses  int         not null default 0,        -- lifetime counter

  -- ── Future: teams / companies ─────────────────────────────────────────────
  company_id      uuid,                                  -- fk to companies (future)

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Analyses ──────────────────────────────────────────────────────────────────
-- One row per uploaded file. Stores both top-level fields (for fast queries
-- in the history list) and the complete analysis blob (for full restoration).

create table if not exists public.analyses (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        references auth.users (id) on delete cascade not null,

  -- File metadata
  file_name         text        not null,
  file_size_kb      int,
  file_path         text,           -- Supabase Storage path: {user_id}/{id}/{file_name}

  -- Spreadsheet metadata
  sheet_name        text,
  row_count         int         not null default 0,
  column_count      int         not null default 0,

  -- Top-level AI fields (denormalized for fast listing / filtering)
  document_type     text,
  risk_level        text        check (risk_level in ('alto', 'médio', 'baixo')),
  executive_summary text,

  -- Full data blobs
  insight           jsonb,          -- DocumentInsight object
  analysis_data     jsonb       not null,  -- complete FileAnalysis object

  -- Processing state (ready for async pipeline in the future)
  status            text        not null default 'completed'
                                check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message     text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Chat Messages ─────────────────────────────────────────────────────────────
-- Each analysis has its own persistent conversation thread.

create table if not exists public.chat_messages (
  id           uuid        primary key default gen_random_uuid(),
  analysis_id  uuid        references public.analyses (id) on delete cascade not null,
  user_id      uuid        references auth.users (id) on delete cascade not null,
  role         text        not null check (role in ('user', 'assistant')),
  content      text        not null,
  created_at   timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Every user can only see and modify their own data.

alter table public.profiles      enable row level security;
alter table public.analyses      enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Analyses
create policy "analyses_select_own" on public.analyses
  for select using (auth.uid() = user_id);
create policy "analyses_insert_own" on public.analyses
  for insert with check (auth.uid() = user_id);
create policy "analyses_update_own" on public.analyses
  for update using (auth.uid() = user_id);
create policy "analyses_delete_own" on public.analyses
  for delete using (auth.uid() = user_id);

-- Chat messages
create policy "messages_select_own" on public.chat_messages
  for select using (auth.uid() = user_id);
create policy "messages_insert_own" on public.chat_messages
  for insert with check (auth.uid() = user_id);

-- ── Auto-create Profile on Sign-up ────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists analyses_user_created_idx
  on public.analyses (user_id, created_at desc);

create index if not exists chat_messages_analysis_idx
  on public.chat_messages (analysis_id, created_at asc);

-- ── Storage Bucket ────────────────────────────────────────────────────────────
-- Files stored under: analysis-files/{user_id}/{analysis_id}/{filename}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'analysis-files',
  'analysis-files',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

create policy "storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'analysis-files' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_select_own" on storage.objects
  for select using (
    bucket_id = 'analysis-files' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'analysis-files' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
