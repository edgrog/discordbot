import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dashUser = await getCurrentUser();
  if (!dashUser) redirect("/login");

  return (
    <div className="min-h-screen bg-chalk">
      <Sidebar
        userEmail={dashUser.email}
        userName={dashUser.name || dashUser.email}
        userRole={dashUser.role}
      />
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
