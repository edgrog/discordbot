-- ─────────────────────────────────────────────────────────────────────────────
-- Grog Partner Dashboard — Row Level Security Policies
-- Run after 001_tables.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── partner_applications ────────────────────────────────────────────────────

alter table partner_applications enable row level security;

create policy "Dashboard users can read applications"
  on partner_applications for select
  to authenticated
  using (exists (select 1 from dashboard_users where id = auth.uid()));

create policy "Dashboard users can update application status"
  on partner_applications for update
  to authenticated
  using (exists (select 1 from dashboard_users where id = auth.uid()))
  with check (exists (select 1 from dashboard_users where id = auth.uid()));

-- ─── dashboard_users ─────────────────────────────────────────────────────────

alter table dashboard_users enable row level security;

create policy "Admins can do everything with dashboard_users"
  on dashboard_users for all
  to authenticated
  using (is_dashboard_admin());

create policy "Users can read own row"
  on dashboard_users for select
  to authenticated
  using (id = auth.uid());

-- ─── form_config ─────────────────────────────────────────────────────────────

alter table form_config enable row level security;

create policy "Authenticated users can read form_config"
  on form_config for select
  to authenticated
  using (true);

create policy "Admins can insert form_config"
  on form_config for insert
  to authenticated
  with check (is_dashboard_admin());

create policy "Admins can update form_config"
  on form_config for update
  to authenticated
  using (is_dashboard_admin());

-- ─── bot_signals ─────────────────────────────────────────────────────────────
-- Bot uses service role key (bypasses RLS). Dashboard inserts via API routes
-- using service role. No RLS policies needed for authenticated users.

alter table bot_signals enable row level security;

-- ─── settings ────────────────────────────────────────────────────────────────

alter table settings enable row level security;

create policy "Authenticated users can read settings"
  on settings for select
  to authenticated
  using (true);

create policy "Admins can update settings"
  on settings for update
  to authenticated
  using (is_dashboard_admin());

create policy "Admins can insert settings"
  on settings for insert
  to authenticated
  with check (is_dashboard_admin());

-- ─── audit_log ───────────────────────────────────────────────────────────────

alter table audit_log enable row level security;

create policy "Authenticated users can insert audit_log"
  on audit_log for insert
  to authenticated
  with check (true);

create policy "Admins can read audit_log"
  on audit_log for select
  to authenticated
  using (is_dashboard_admin());
