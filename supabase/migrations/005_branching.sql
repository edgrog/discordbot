-- ============================================
-- Migration 005: Conditional Branching
-- ============================================

-- Add step_type: "fields" (modal) or "select" (StringSelectMenu)
ALTER TABLE form_steps ADD COLUMN step_type text NOT NULL DEFAULT 'fields'
  CHECK (step_type IN ('fields', 'select'));

-- Options for select steps: [{ label, value, next_step }]
ALTER TABLE form_steps ADD COLUMN options jsonb DEFAULT NULL;

-- Explicit next step for fields steps (null = next in order)
ALTER TABLE form_steps ADD COLUMN next_step int DEFAULT NULL;
