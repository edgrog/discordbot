// === Multi-Form Types ===

export interface Form {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  discord_command_name: string | null;
  settings: FormSettings;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  submission_count?: number;
}

export interface FormSettings {
  role_id?: string;
  dm_approve_template?: string;
  dm_reject_template?: string;
  admin_channel_id?: string;
  apply_channel_id?: string;
  apply_message_id?: string;
  has_categories?: boolean;
  categories?: Record<string, { label: string; emoji: string }>;
}

export interface SelectOption {
  label: string;
  value: string;
  next_step: number | null;
}

export interface FormStep {
  id: string;
  form_id: string;
  position: number;
  title: string;
  step_type: "fields" | "select";
  fields: FormField[];
  options: SelectOption[] | null;
  next_step: number | null;
  created_at: string;
  updated_at: string;
}

export interface FieldOption {
  label: string;
  value: string;
  next_step?: number | null;
}

export interface FormField {
  key: string;
  label: string;
  type: "short" | "paragraph" | "singleselect" | "multiselect";
  required: boolean;
  placeholder?: string;
  options?: FieldOption[];
  branching?: boolean;
}

export interface Submission {
  id: string;
  form_id: string;
  created_at: string;
  discord_id: string;
  discord_username: string | null;
  answers: Record<string, string>;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  review_note: string | null;
  dm_sent: boolean;
  form_name?: string;
  form_slug?: string;
}

export interface DashboardUser {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "member";
  created_at: string;
  created_by: string | null;
  last_login: string | null;
}

export interface AuditLogEntry {
  id: number;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  meta: Record<string, unknown> | null;
}

export interface BotSignal {
  id: number;
  created_at: string;
  signal: string;
  processed: boolean;
  processed_at: string | null;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
}

// Status colors for badges
export const STATUS_COLORS: Record<string, string> = {
  pending: "#FF6B00",
  approved: "#BFFF00",
  rejected: "#FF3366",
};

// Form status colors
export const FORM_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#FFE500", text: "#141414" },
  active: { bg: "#BFFF00", text: "#141414" },
  archived: { bg: "#E5E7EB", text: "#6B7280" },
};
