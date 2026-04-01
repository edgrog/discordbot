-- ============================================
-- Migration 004: RLS for Multi-Form Tables
-- ============================================

-- forms
alter table forms enable row level security;

create policy "Authenticated users can read forms"
  on forms for select
  to authenticated
  using (true);

create policy "Admins can insert forms"
  on forms for insert
  to authenticated
  with check (is_dashboard_admin());

create policy "Admins can update forms"
  on forms for update
  to authenticated
  using (is_dashboard_admin());

create policy "Admins can delete forms"
  on forms for delete
  to authenticated
  using (is_dashboard_admin());

-- form_steps
alter table form_steps enable row level security;

create policy "Authenticated users can read form_steps"
  on form_steps for select
  to authenticated
  using (true);

create policy "Admins can insert form_steps"
  on form_steps for insert
  to authenticated
  with check (is_dashboard_admin());

create policy "Admins can update form_steps"
  on form_steps for update
  to authenticated
  using (is_dashboard_admin());

create policy "Admins can delete form_steps"
  on form_steps for delete
  to authenticated
  using (is_dashboard_admin());

-- submissions
alter table submissions enable row level security;

create policy "Dashboard users can read submissions"
  on submissions for select
  to authenticated
  using (
    exists (
      select 1 from dashboard_users where id = auth.uid()
    )
  );

create policy "Dashboard users can update submissions"
  on submissions for update
  to authenticated
  using (
    exists (
      select 1 from dashboard_users where id = auth.uid()
    )
  );

-- Insert handled by service role (bot), no RLS policy needed
