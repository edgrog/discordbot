const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "#FF6B00", text: "#141414", label: "Pending" },
  approved: { bg: "#BFFF00", text: "#141414", label: "Approved" },
  rejected: { bg: "#FF3366", text: "#FFFFFF", label: "Rejected" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { bg: "#E5E7EB", text: "#141414", label: status };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[11px] font-black uppercase tracking-wide border-2 border-ink"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {status === "pending" && (
        <span className="w-1.5 h-1.5 bg-ink rounded-full mr-1.5 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
