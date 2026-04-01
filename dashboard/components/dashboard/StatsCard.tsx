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
    <div
      className="bg-card border-2 border-ink p-5 brutalist-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-8 h-8 border-2 border-ink flex items-center justify-center"
          style={{ backgroundColor: accentColor || "#BFFF00" }}
        >
          <Icon className="w-4 h-4 text-ink" strokeWidth={2.5} />
        </div>
        {pulse && (
          <span
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: accentColor || "#FF6B00" }}
          />
        )}
      </div>
      <p className="text-3xl font-black text-ink tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-ink/50 mt-1 uppercase tracking-wide">
        {title}
      </p>
    </div>
  );
}
