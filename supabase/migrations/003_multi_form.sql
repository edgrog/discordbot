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

-- 5. Migrate existing form_config into forms + form_steps
-- Create the legacy "Partner Application" form (only if form_config has data)
do $$
declare
  legacy_form_id uuid := '00000000-0000-0000-0000-000000000001';
  has_data boolean;
begin
  select exists(select 1 from form_config limit 1) into has_data;

  if has_data then
    insert into forms (id, name, slug, description, status, discord_command_name, settings)
    values (
      legacy_form_id,
      'Partner Application',
      'apply',
      'Apply to become a partner',
      'active',
      'apply',
      jsonb_build_object(
        'has_categories', true,
        'categories', jsonb_build_object(
          'bar', jsonb_build_object('label', 'Bar / Venue', 'emoji', '🍺'),
          'club', jsonb_build_object('label', 'Club', 'emoji', '🎉'),
          'artist', jsonb_build_object('label', 'Artist', 'emoji', '🎨'),
          'creator', jsonb_build_object('label', 'Creator', 'emoji', '🎥')
        )
      )
    )
    on conflict (slug) do nothing;

    -- Migrate form_config rows into form_steps
    insert into form_steps (form_id, position, title, fields)
    select
      legacy_form_id,
      row_number() over (order by
        case category
          when 'personal' then 0
          when 'bar' then 1
          when 'club' then 2
          when 'artist' then 3
          when 'creator' then 4
        end,
        step
      )::int,
      step_title,
      fields
    from form_config
    order by category, step
    on conflict (form_id, position) do nothing;
  end if;
end $$;

-- 6. Migrate existing partner_applications into submissions
insert into submissions (form_id, created_at, discord_id, discord_username, answers, status, reviewed_by, review_note, dm_sent)
select
  '00000000-0000-0000-0000-000000000001',
  created_at,
  discord_id,
  discord_username,
  jsonb_build_object(
    'full_name', coalesce(full_name, ''),
    'email', coalesce(email, ''),
    'phone', coalesce(phone, ''),
    'dob', coalesce(dob, ''),
    'address', coalesce(address, ''),
    'city', coalesce(city, ''),
    'state', coalesce(state, ''),
    'zip', coalesce(zip, ''),
    'country', coalesce(country, ''),
    'category', coalesce(category, '')
  ) || coalesce(answers, '{}'::jsonb),
  status,
  reviewed_by,
  review_note,
  dm_sent
from partner_applications
where exists (select 1 from forms where id = '00000000-0000-0000-0000-000000000001')
on conflict do nothing;
