import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  pulse?: boolean;
  accentColor?: string;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  pulse,
  accentColor,
}: StatsCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon
          className="w-5 h-5"
          style={{ color: accentColor || "#6B7280" }}
        />
        {pulse && (
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{title}</p>
    </div>
  );
}
