import { CATEGORY_LABELS, CategoryType } from "@/lib/types";

const BADGE_COLORS: Record<string, string> = {
  creator: "#8B5CF6",
  artist: "#FF6B00",
  club: "#00D4FF",
  bar: "#3366FF",
};

export function CategoryBadge({ category }: { category: CategoryType }) {
  const color = BADGE_COLORS[category] || "#141414";

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[11px] font-black uppercase tracking-wide border-2 border-ink"
      style={{ backgroundColor: color, color: "#fff" }}
    >
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}
