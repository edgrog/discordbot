"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  PenTool,
  Users,
  ScrollText,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BotStatus } from "./BotStatus";

interface SidebarProps {
  userEmail: string;
  userName: string | null;
  userRole: "admin" | "member";
}

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Home", adminOnly: false },
  {
    href: "/applications",
    icon: FileText,
    label: "Applications",
    adminOnly: false,
  },
  { href: "/forms", icon: PenTool, label: "Forms", adminOnly: true },
  { href: "/team", icon: Users, label: "Team", adminOnly: true },
  { href: "/audit", icon: ScrollText, label: "Audit Log", adminOnly: true },
  { href: "/settings", icon: Settings, label: "Settings", adminOnly: true },
];

export function Sidebar({ userEmail, userName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || userRole === "admin"
  );

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#111827] flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍋</span>
          <span className="text-xl font-bold text-white">Grog</span>
        </div>
        <p className="text-xs text-[#9CA3AF] mt-1 ml-10">Partner Dashboard</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "text-white bg-white/10 border-l-2 border-[#FFD700] ml-0 pl-2.5"
                  : "text-[#9CA3AF] hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bot Status */}
      <div className="px-4 py-3 border-t border-white/10">
        <BotStatus />
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {userName || userEmail.split("@")[0]}
            </p>
            <p className="text-xs text-[#9CA3AF] truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-[#9CA3AF] hover:text-white transition-colors p-1"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
