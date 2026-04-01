"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CATEGORY_COLORS, CATEGORY_LABELS, CategoryType } from "@/lib/types";

interface CategoryChartProps {
  data: Record<string, number>;
}

export function CategoryChart({ data }: CategoryChartProps) {
  const chartData = Object.entries(data).map(([category, count]) => ({
    name: CATEGORY_LABELS[category as CategoryType] || category,
    value: count,
    color: CATEGORY_COLORS[category as CategoryType] || "#6B7280",
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="text-sm font-semibold text-gray-900">
          Category Breakdown
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          No data yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Category Breakdown
      </h3>

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              `${value} (${((Number(value) / total) * 100).toFixed(0)}%)`,
              String(name),
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="space-y-2 mt-4">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-gray-600">{item.name}</span>
            </div>
            <span className="text-xs font-medium text-gray-900">
              {item.value} ({((item.value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
