import Link from "next/link";
import { PartnerApplication, CategoryType } from "@/lib/types";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { CategoryBadge } from "@/components/applications/CategoryBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

interface RecentApplicationsProps {
  applications: PartnerApplication[];
}

export function RecentApplications({
  applications,
}: RecentApplicationsProps) {
  if (applications.length === 0) {
    return (
      <div className="bg-card border-2 border-ink p-8 text-center brutalist-shadow">
        <div className="text-4xl mb-3">-_-</div>
        <h3 className="text-sm font-black text-ink uppercase">
          No submissions yet
        </h3>
        <p className="text-xs text-ink/50 mt-1">
          Deploy the bot and share the /apply command
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border-2 border-ink overflow-hidden brutalist-shadow">
      <div className="px-5 py-3 border-b-2 border-ink bg-pop-lime">
        <h3 className="text-sm font-black text-ink uppercase tracking-wide">
          Recent Submissions
        </h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Discord</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((app) => (
            <TableRow key={app.id} className="hover:bg-chalk">
              <TableCell className="font-bold text-ink">
                {app.full_name || "—"}
              </TableCell>
              <TableCell>
                <CategoryBadge category={app.category as CategoryType} />
              </TableCell>
              <TableCell className="text-ink/60 font-mono text-xs">
                {app.discord_username || app.discord_id}
              </TableCell>
              <TableCell className="text-ink/60 text-xs">
                {formatDistanceToNow(new Date(app.created_at), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                <StatusBadge status={app.status} />
              </TableCell>
              <TableCell>
                <Link
                  href="/applications"
                  className="text-xs font-bold text-ink/40 hover:text-ink uppercase"
                >
                  View &rarr;
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
