import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DollarSign, Users, BookOpen, RotateCcw, AlertTriangle, TrendingUp, Timer } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { api, fmt, fmtDate } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader, Table } from "./AdminLayout";

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  const [hw, setHw] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then((r) => setD(r.data)); api.get("/admin/time/hours-week").then((r) => setHw(r.data)).catch(() => {}); }, []);
  if (!d) return <Spinner />;

  const stats = [
    { label: "Revenue", value: fmt(d.revenue), icon: DollarSign, sub: `${d.orders} paid orders` },
    { label: "Active students", value: d.active_students, icon: Users, sub: `${d.students} registered` },
    { label: "At risk", value: d.at_risk_students, icon: AlertTriangle, sub: "no activity 7+ days" },
    { label: "Avg completion", value: `${d.avg_completion}%`, icon: TrendingUp, sub: "across enrolled" },
    { label: "Hours this week", value: hw ? `${(hw.client + hw.student + hw.internal).toFixed(1)}h` : "—", icon: Timer, sub: hw ? `${hw.client}h clients · ${hw.student}h students` : "" },
    { label: "Courses", value: d.published_courses, icon: BookOpen, sub: `${d.courses} total` },
  ];

  return (
    <div data-testid="admin-dashboard">
      <AdminHeader title="Dashboard" sub="A snapshot of how the academy is performing." />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="card-lux p-6" data-testid={`stat-${s.label.toLowerCase().replace(/ /g, "-")}`}>
            <div className="flex justify-between items-start"><div className="eyebrow">{s.label}</div><s.icon size={16} className="text-amber-600" /></div>
            <div className="font-serif text-3xl text-[#0A192F] mt-3">{s.value}</div>
            <div className="text-xs text-slate-400 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="card-lux p-6 lg:col-span-2">
          <div className="eyebrow mb-4">Monthly revenue</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.monthly.length ? d.monthly : [{ month: "—", revenue: 0 }]}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4AF37" stopOpacity={0.5} /><stop offset="100%" stopColor="#D4AF37" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tickFormatter={(v) => `$${v / 100}`} tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#B89732" fill="url(#g)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-lux p-6">
          <div className="eyebrow mb-4">Top courses</div>
          <ul className="space-y-3">
            {d.top_courses.length === 0 && <li className="text-sm text-slate-400">No enrollments yet.</li>}
            {d.top_courses.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 text-sm"><span className="font-mono text-xs text-slate-400">0{i + 1}</span><Link to={`/admin/courses/${c.id}`} className="flex-1 truncate hover:text-amber-700">{c.title}</Link><span className="gold-badge">{c.enrollments}</span></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="eyebrow mb-3">Recent orders</div>
      <Table cols={["Order", "Customer", "Items", "Total", "Status", "Date"]} rows={d.recent_orders} testId="recent-orders"
        render={(o) => (
          <tr key={o.id}><td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td><td className="px-4 py-3">{o.email}</td><td className="px-4 py-3 text-slate-500 truncate max-w-xs">{o.items.map((i) => i.title).join(", ")}</td><td className="px-4 py-3 font-medium">{fmt(o.total)}</td><td className="px-4 py-3"><span className="gold-badge">{o.status}</span></td><td className="px-4 py-3 text-slate-500">{fmtDate(o.created_at)}</td></tr>
        )} />
    </div>
  );
}
