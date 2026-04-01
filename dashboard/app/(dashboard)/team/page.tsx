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
      <PageHeader title="Team" description="Manage dashboard access" />

      {/* Invite Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
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
            />
          </div>
          <Select
            value={inviteRole}
            onValueChange={(v) => setInviteRole(v as "admin" | "member")}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={isInviting}>
            {isInviting ? "Sending..." : "Send Invite"}
          </Button>
        </form>
      </div>

      {/* Team Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.name || u.email.split("@")[0]}
                </TableCell>
                <TableCell className="text-gray-600">{u.email}</TableCell>
                <TableCell>
                  <Select
                    value={u.role}
                    onValueChange={(v) => v && handleRoleChange(u.id, v)}
                    disabled={u.id === currentUserId}
                  >
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-gray-600">
                  {u.last_login
                    ? formatDistanceToNow(new Date(u.last_login), {
                        addSuffix: true,
                      })
                    : "Never"}
                </TableCell>
                <TableCell>
                  {u.id !== currentUserId && (
                    <AlertDialog>
                      <AlertDialogTrigger className="text-gray-400 hover:text-red-500 p-1">
                          <Trash2 className="w-4 h-4" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Remove {u.name || u.email}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            They&apos;ll lose access immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleRemove(u.id, u.name || u.email)
                            }
                            className="bg-red-600 hover:bg-red-700"
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
