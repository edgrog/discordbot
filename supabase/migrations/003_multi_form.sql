-- ============================================
-- Migration 003: Multi-Form Architecture
-- ============================================

-- 1. New table: forms
create table if not exists forms (
  id                   uuid default gen_random_uuid() primary key,
  name                 text not null,
  slug                 text unique not null,
  description          text,
  status               text default 'draft' check (status in ('draft', 'active', 'archived')),
  discord_command_name text,
  settings             jsonb default '{}'::jsonb,
  created_at           timestamptz default now(),
  created_by           uuid references dashboard_users(id),
  updated_at           timestamptz default now(),
  updated_by           uuid references dashboard_users(id)
);

-- 2. New table: form_steps
create table if not exists form_steps (
  id         uuid default gen_random_uuid() primary key,
  form_id    uuid not null references forms(id) on delete cascade,
  position   int not null,
  title      text not null,
  fields     jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(form_id, position)
);

-- 3. New table: submissions
create table if not exists submissions (
  id               uuid default gen_random_uuid() primary key,
  form_id          uuid not null references forms(id),
  discord_id       text not null,
  discord_username text,
  answers          jsonb not null default '{}'::jsonb,
  status           text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by      text,
  review_note      text,
  dm_sent          boolean default false,
  created_at       timestamptz default now()
);

-- 4. Indexes
create index idx_form_steps_form_id on form_steps(form_id);
create index idx_submissions_form_id on submissions(form_id);
create index idx_submissions_status on submissions(status);
create index idx_forms_status on forms(status);
create index idx_forms_slug on forms(slug);

-- No data seeding — forms are created from the dashboard
