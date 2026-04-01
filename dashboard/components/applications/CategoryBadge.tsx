import { Badge } from "@/components/ui/badge";
import { CATEGORY_COLORS, CATEGORY_LABELS, CategoryType } from "@/lib/types";

export function CategoryBadge({ category }: { category: CategoryType }) {
  const color = CATEGORY_COLORS[category] || "#6B7280";

  return (
    <Badge
      variant="outline"
      className="border"
      style={{
        color,
        borderColor: `${color}33`,
        backgroundColor: `${color}0D`,
      }}
    >
      {CATEGORY_LABELS[category] || category}
    </Badge>
  );
}
