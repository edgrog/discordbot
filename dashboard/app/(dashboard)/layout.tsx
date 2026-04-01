import { Sidebar } from "@/components/shared/Sidebar";

// TODO: TEMPORARY — auth bypassed for testing. Re-enable before production.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dashUser = { email: "ed@grog.shop", name: "Ed", role: "admin" as const };

  return (
    <div className="min-h-screen bg-chalk">
      <Sidebar
        userEmail={dashUser.email}
        userName={dashUser.name}
        userRole={dashUser.role}
      />
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
