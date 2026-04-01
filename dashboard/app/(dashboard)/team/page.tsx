"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { DashboardUser } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { Trash2, UserPlus } from "lucide-react";

export default function TeamPage() {
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
  }, []);

  async function fetchCurrentUser() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  }

  async function fetchUsers() {
    const supabase = createClient();
    const { data } = await supabase
      .from("dashboard_users")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setUsers(data as DashboardUser[]);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to invite");
        return;
      }

      toast.success("Invite sent");
      setInviteEmail("");
      fetchUsers();
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const res = await fetch(`/api/team/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        toast.error("Failed to update role");
        return;
      }

      toast.success("Role updated");
      fetchUsers();
    } catch {
      toast.error("Failed to update role");
    }
  }

  async function handleRemove(userId: string, name: string) {
    try {
      const res = await fetch(`/api/team/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to remove");
        return;
      }

      toast.success(`${name} removed`);
      fetchUsers();
    } catch {
      toast.error("Failed to remove user");
    }
  }

  return (
    <div>
      <PageHeader title="Team" description="Manage Formie dashboard access" />

      {/* Invite Section */}
      <div className="bg-card border-2 border-ink p-5 mb-6 brutalist-shadow">
        <h3 className="text-sm font-black uppercase tracking-wide text-ink mb-3">
          <UserPlus className="w-4 h-4 inline mr-2" />
          Invite Team Member
        </h3>
        <form onSubmit={handleInvite} className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="border-2 border-ink rounded-none"
            />
          </div>
          <Select
            value={inviteRole}
            onValueChange={(v) => setInviteRole(v as "admin" | "member")}
          >
            <SelectTrigger className="w-32 border-2 border-ink rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="submit"
            disabled={isInviting}
            className="bg-ink text-white font-black uppercase hover:brutalist-shadow-sm"
          >
            {isInviting ? "Sending..." : "Send Invite"}
          </Button>
        </form>
      </div>

      {/* Team Table */}
      <div className="bg-card border-2 border-ink brutalist-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-ink bg-chalk">
              <TableHead className="font-black uppercase tracking-wide text-ink text-xs">Name</TableHead>
              <TableHead className="font-black uppercase tracking-wide text-ink text-xs">Email</TableHead>
              <TableHead className="font-black uppercase tracking-wide text-ink text-xs">Role</TableHead>
              <TableHead className="font-black uppercase tracking-wide text-ink text-xs">Last Login</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className="border-b border-ink/10">
                <TableCell className="font-bold text-ink">
                  {u.name || u.email.split("@")[0]}
                </TableCell>
                <TableCell className="font-mono text-xs text-ink/60">{u.email}</TableCell>
                <TableCell>
                  <Select
                    value={u.role}
                    onValueChange={(v) => v && handleRoleChange(u.id, v)}
                    disabled={u.id === currentUserId}
                  >
                    <SelectTrigger className="w-28 h-8 border-2 border-ink rounded-none text-xs font-bold uppercase">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="font-mono text-xs text-ink/50">
                  {u.last_login
                    ? formatDistanceToNow(new Date(u.last_login), {
                        addSuffix: true,
                      })
                    : "Never"}
                </TableCell>
                <TableCell>
                  {u.id !== currentUserId && (
                    <AlertDialog>
                      <AlertDialogTrigger className="text-ink/30 hover:text-[#FF3366] p-1 transition-colors">
                          <Trash2 className="w-4 h-4" />
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-2 border-ink rounded-none brutalist-shadow">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-black uppercase tracking-wide text-ink">
                            Remove {u.name || u.email}?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-ink/60 font-medium">
                            They&apos;ll lose access immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-2 border-ink rounded-none font-bold uppercase">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleRemove(u.id, u.name || u.email)
                            }
                            className="bg-[#FF3366] text-white border-2 border-ink rounded-none font-black uppercase hover:bg-[#FF3366]/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
