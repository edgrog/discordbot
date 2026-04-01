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
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          No applications yet
        </h3>
        <p className="text-sm text-gray-500">
          Share the /apply command in your Discord
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">
          Recent Applications
        </h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Discord</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((app) => (
            <TableRow key={app.id}>
              <TableCell className="font-medium">
                {app.full_name || "—"}
              </TableCell>
              <TableCell>
                <CategoryBadge category={app.category as CategoryType} />
              </TableCell>
              <TableCell className="text-gray-600">
                {app.discord_username || app.discord_id}
              </TableCell>
              <TableCell className="text-gray-600">
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
                  className="text-sm text-gray-500 hover:text-gray-900"
                >
                  Review &rarr;
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
