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
  Zap,
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
  { href: "/applications", icon: FileText, label: "Submissions", adminOnly: false },
  { href: "/forms", icon: PenTool, label: "Forms", adminOnly: true },
  { href: "/team", icon: Users, label: "Team", adminOnly: true },
  { href: "/audit", icon: ScrollText, label: "Audit", adminOnly: true },
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
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-ink flex flex-col border-r-3 border-ink">
      {/* Logo */}
      <div className="px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-pop-lime border-2 border-ink flex items-center justify-center">
            <Zap className="w-4 h-4 text-ink" strokeWidth={3} />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-white uppercase">
              Formie
            </span>
          </div>
        </div>
        <p className="text-[11px] text-white/40 mt-1.5 ml-[42px] uppercase tracking-widest">
          Discord Forms
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 mt-2">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? "text-ink bg-pop-lime -mx-0.5 px-3.5"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
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
            <p className="text-sm font-bold text-white truncate">
              {userName || userEmail.split("@")[0]}
            </p>
            <p className="text-[11px] text-white/40 truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-white/40 hover:text-pop-pink transition-colors p-1"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
