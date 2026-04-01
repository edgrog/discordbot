import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  pending:
    "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50",
  approved:
    "bg-green-50 text-green-700 border-green-200 hover:bg-green-50",
  rejected:
    "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status] || ""}>
      {status === "pending" && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
