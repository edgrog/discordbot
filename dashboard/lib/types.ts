export interface DashboardUser {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "member";
  created_at: string;
  created_by: string | null;
  last_login: string | null;
}

export interface FormField {
  key: string;
  label: string;
  type: "short" | "paragraph";
  required: boolean;
  placeholder?: string;
}

export interface FormConfig {
  id: number;
  category: "personal" | "bar" | "club" | "artist" | "creator";
  step: number;
  step_title: string;
  fields: FormField[];
  updated_at: string;
  updated_by: string | null;
}

export interface PartnerApplication {
  id: number;
  created_at: string;
  discord_id: string;
  discord_username: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  category: "bar" | "club" | "artist" | "creator";
  answers: Record<string, string>;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  review_note: string | null;
  dm_sent: boolean;
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

export type CategoryType = "creator" | "artist" | "club" | "bar";

export const CATEGORY_LABELS: Record<CategoryType, string> = {
  creator: "Creator",
  artist: "Artist",
  club: "Club",
  bar: "Venue",
};

export const CATEGORY_COLORS: Record<CategoryType, string> = {
  creator: "#8B5CF6",
  artist: "#FF6B00",
  club: "#00D4FF",
  bar: "#3366FF",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "#FF6B00",
  approved: "#BFFF00",
  rejected: "#FF3366",
};
