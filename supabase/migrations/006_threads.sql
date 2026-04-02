-- ============================================
-- Migration 006: Thread-Based Application Sessions
-- ============================================

CREATE TABLE application_sessions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id           TEXT UNIQUE NOT NULL,
  form_id             UUID NOT NULL REFERENCES forms(id),
  discord_id          TEXT NOT NULL,
  guild_id            TEXT NOT NULL,
  current_step        INT NOT NULL DEFAULT 0,
  current_field       INT NOT NULL DEFAULT 0,
  answers             JSONB NOT NULL DEFAULT '{}'::JSONB,
  status              TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress','confirming','submitted','abandoned','timed_out')),
  pending_multiselect JSONB DEFAULT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_sessions_thread ON application_sessions(thread_id);
CREATE INDEX idx_sessions_user_form ON application_sessions(discord_id, form_id);
CREATE INDEX idx_sessions_expires ON application_sessions(expires_at)
  WHERE status = 'in_progress';

-- RLS policies
ALTER TABLE application_sessions ENABLE ROW LEVEL SECURITY;

-- Service role (bot) can do everything
CREATE POLICY "service_role_all" ON application_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Dashboard users can read sessions
CREATE POLICY "authenticated_read" ON application_sessions
  FOR SELECT TO authenticated USING (true);
