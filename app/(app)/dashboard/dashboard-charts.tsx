"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type StockPoint = { name: string; quantity: number };
type WeeklyPoint = { week: string; receipts: number; issues: number };

const axisStyle = { fontSize: 12, fill: "#64748b" };

function StockChart({ data, color }: { data: StockPoint[]; color: string }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "#f8fafc" }} />
          <Bar dataKey="quantity" name="On hand" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardCharts({
  categoryStock,
  locationStock,
  weeklyVolume,
}: {
  categoryStock: StockPoint[];
  locationStock: StockPoint[];
  weeklyVolume: WeeklyPoint[];
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Stock by category</h2>
        <div className="mt-4"><StockChart data={categoryStock} color="#0f766e" /></div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Stock by location</h2>
        <div className="mt-4"><StockChart data={locationStock} color="#334155" /></div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
        <h2 className="text-base font-semibold text-slate-950">Receipt and issue volume - last 8 weeks</h2>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyVolume} margin={{ top: 8, right: 16, left: -20, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="week" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="receipts" name="Receipts" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="issues" name="Issues" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
