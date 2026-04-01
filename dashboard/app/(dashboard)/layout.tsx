import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/shared/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: dashUser } = await supabase
    .from("dashboard_users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!dashUser) redirect("/login?error=access_denied");

  return (
    <div className="min-h-screen bg-page">
      <Sidebar
        userEmail={dashUser.email}
        userName={dashUser.name}
        userRole={dashUser.role}
      />
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
