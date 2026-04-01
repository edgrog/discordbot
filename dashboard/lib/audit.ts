import { createServiceClient } from "@/lib/supabase/server";

export async function writeAuditLog(params: {
  userId: string;
  userEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();

  const { error } = await supabase.from("audit_log").insert({
    user_id: params.userId,
    user_email: params.userEmail,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    meta: params.meta || null,
  });

  if (error) {
    console.error("[AUDIT] Failed to write audit log:", error.message);
  }
}
