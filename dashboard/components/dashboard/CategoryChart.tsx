"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface CategoryChartProps {
  data: Record<string, number>;
}

const CHART_COLORS = ["#BFFF00", "#FF3366", "#3366FF", "#FF6B00", "#8B5CF6", "#00D4FF"];

export function CategoryChart({ data }: CategoryChartProps) {
  const chartData = Object.entries(data).map(([name, count], i) => ({
    name,
    value: count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="bg-card border-2 border-ink p-8 text-center brutalist-shadow">
        <div className="text-2xl mb-2 font-black">?</div>
        <h3 className="text-sm font-black text-ink uppercase">
          Submissions by Form
        </h3>
        <p className="text-xs text-ink/50 mt-1">No data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-card border-2 border-ink p-5 brutalist-shadow">
      <h3 className="text-sm font-black text-ink uppercase tracking-wide mb-4">
        Submissions by Form
      </h3>

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={2}
            stroke="#141414"
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
            contentStyle={{
              background: "#141414",
              border: "2px solid #141414",
              color: "#F5F5F0",
              fontSize: "12px",
              fontWeight: 700,
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-2 mt-4">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 border border-ink"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs font-semibold text-ink/70">{item.name}</span>
            </div>
            <span className="text-xs font-black text-ink tabular-nums">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
