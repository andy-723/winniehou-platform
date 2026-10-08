import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { FileText, FileSpreadsheet, FileDown, Users, UserCog } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader } from "./AdminLayout";

const h = (m) => +(m / 60).toFixed(1);
const PALETTE = ["#0A192F", "#B8860B", "#C9A227", "#1E3A5F", "#8C6D1F", "#476184", "#E2C275", "#2E4A6B"];

const presetRange = (p) => {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  if (p === "this-week") { const d = new Date(today); d.setDate(today.getDate() - ((today.getDay() + 6) % 7)); return { from: iso(d), to: iso(today) }; }
  if (p === "this-month") return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
  if (p === "last-month") { const s = new Date(today.getFullYear(), today.getMonth() - 1, 1); const e = new Date(today.getFullYear(), today.getMonth(), 0); return { from: iso(s), to: iso(e) }; }
  if (p === "last-30") { const d = new Date(today); d.setDate(today.getDate() - 30); return { from: iso(d), to: iso(today) }; }
  return { from: "", to: "" };
};

export default function AdminReports() {
  const [preset, setPreset] = useState("this-month");
  const [range, setRange] = useState(presetRange("this-month"));
  const [subject, setSubject] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");

  const params = () => ({ date_from: range.from || undefined, date_to: range.to || undefined, subject_type: subject === "all" ? undefined : subject });
  const load = () => { setLoading(true); api.get("/admin/time/reports", { params: params() }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [range, subject]); // eslint-disable-line

  const choosePreset = (p) => { setPreset(p); if (p !== "custom") setRange(presetRange(p)); };

  const download = async (format) => {
    setBusy(format);
    try {
      const res = await api.get("/admin/time/reports/export", { params: { ...params(), format }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `time-report.${format === "xlsx" ? "xlsx" : format}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  };

  if (!data) return <Spinner />;
  const t = data.totals;
  const dailyChart = data.daily.map((d) => ({ date: d.date.slice(5), Billable: h(d.billable), "Non-billable": h(d.non_billable) }));
  const clientDonut = data.by_client.filter((c) => c.hours > 0).map((c) => ({ name: c.name, value: c.hours }));

  const cards = [
    ["Total hours", `${h(t.total_minutes)}h`],
    ["Billable", `${h(t.billable_minutes)}h`],
    ["Non-billable", `${h(t.non_billable_minutes)}h`],
    ["Package revenue", fmt(t.revenue_cents, "AUD")],
    ["Clients / Students", `${t.clients} / ${t.students}`],
  ];

  return (
    <div data-testid="admin-reports">
      <AdminHeader title="Reports" sub="Hours, billable split and profitability across clients and students" right={
        <div className="flex gap-2 items-center">
          {loading && <span className="text-xs text-slate-400" data-testid="report-loading">Updating…</span>}
          <button onClick={() => download("pdf")} disabled={busy} className="btn-outline !py-2 !text-sm disabled:opacity-50" data-testid="export-pdf"><FileText size={15} /> PDF</button>
          <button onClick={() => download("csv")} disabled={busy} className="btn-outline !py-2 !text-sm disabled:opacity-50" data-testid="export-csv"><FileDown size={15} /> CSV</button>
          <button onClick={() => download("xlsx")} disabled={busy} className="btn-outline !py-2 !text-sm disabled:opacity-50" data-testid="export-xlsx"><FileSpreadsheet size={15} /> XLS</button>
        </div>} />

      {/* range controls */}
      <div className="card-lux p-4 mb-6 flex flex-wrap items-end gap-3" data-testid="report-controls">
        <div className="flex gap-1.5 flex-wrap">
          {[["this-week", "This week"], ["this-month", "This month"], ["last-month", "Last month"], ["last-30", "Last 30 days"], ["custom", "Custom"]].map(([id, l]) => (
            <button key={id} onClick={() => choosePreset(id)} className={`px-3 py-1.5 text-xs rounded-lg ${preset === id ? "bg-[#0A192F] text-amber-300" : "text-slate-600 hover:bg-stone-100"}`} data-testid={`preset-${id}`}>{l}</button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex gap-2 items-end">
            <label className="text-xs text-slate-500">From<input type="date" className="input-lux !py-1.5 block mt-1" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} data-testid="report-from" /></label>
            <label className="text-xs text-slate-500">To<input type="date" className="input-lux !py-1.5 block mt-1" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} data-testid="report-to" /></label>
          </div>
        )}
        <div className="flex gap-1.5 ml-auto">
          {[["all", "All"], ["client", "Clients"], ["student", "Students"]].map(([id, l]) => (
            <button key={id} onClick={() => setSubject(id)} className={`px-3 py-1.5 text-xs rounded-lg ${subject === id ? "bg-amber-500/20 text-amber-800 border border-amber-500/40" : "text-slate-600 hover:bg-stone-100"}`} data-testid={`report-subject-${id}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6" data-testid="report-cards">
        {cards.map(([l, v]) => <div key={l} className="card-lux p-4"><div className="eyebrow">{l}</div><div className="font-serif text-2xl text-[#0A192F] mt-1">{v}</div></div>)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="card-lux p-6 lg:col-span-2" data-testid="report-bar">
          <div className="eyebrow mb-4">Hours per day · billable vs non-billable</div>
          {dailyChart.length === 0 ? <div className="text-slate-400 text-sm py-16 text-center">No time in this range.</div> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyChart} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip formatter={(v) => `${v}h`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Billable" stackId="a" fill="#0A192F" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Non-billable" stackId="a" fill="#B8860B" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card-lux p-6" data-testid="report-donut">
          <div className="eyebrow mb-4">Hours by client</div>
          {clientDonut.length === 0 ? <div className="text-slate-400 text-sm py-16 text-center">No client time.</div> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={clientDonut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {clientDonut.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v}h`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* clients table */}
      <div className="card-lux p-6 mb-6" data-testid="report-clients">
        <div className="flex items-center gap-2 mb-4"><UserCog size={16} className="text-amber-700" /><div className="eyebrow">Clients — premium 1-on-1 · every session billable, watch profitability</div></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400"><tr><th className="text-left py-2">Client</th><th className="text-left py-2">Package</th><th className="text-right py-2">Revenue</th><th className="text-right py-2">Hours</th><th className="text-right py-2">Billable</th><th className="text-right py-2">Effective $/h</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.by_client.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-slate-400">No client time in this range.</td></tr> :
                data.by_client.map((c) => (
                  <tr key={c.client_id} data-testid={`report-client-${c.client_id}`}>
                    <td className="py-2 text-slate-800">{c.name}</td>
                    <td className="py-2 text-slate-500">{c.package}</td>
                    <td className="py-2 text-right font-mono">{fmt(c.price_cents, "AUD")}</td>
                    <td className="py-2 text-right font-mono">{c.hours}h</td>
                    <td className="py-2 text-right font-mono">{c.billable_hours}h</td>
                    <td className={`py-2 text-right font-mono font-semibold ${c.rate != null && c.rate < 100 ? "text-red-600" : "text-[#0A192F]"}`}>{c.rate != null ? fmt(c.rate * 100, "AUD") : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* students table */}
      <div className="card-lux p-6" data-testid="report-students">
        <div className="flex items-center gap-2 mb-4"><Users size={16} className="text-[#0A192F]" /><div className="eyebrow">Students — light reconnect sessions (~30–45 min, once or twice)</div></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400"><tr><th className="text-left py-2">Student</th><th className="text-right py-2">Reconnect sessions</th><th className="text-right py-2">Hours</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.by_student.length === 0 ? <tr><td colSpan={3} className="py-6 text-center text-slate-400">No student time in this range.</td></tr> :
                data.by_student.map((s) => (
                  <tr key={s.student_id} data-testid={`report-student-${s.student_id}`}>
                    <td className="py-2 text-slate-800">{s.name}</td>
                    <td className="py-2 text-right font-mono">{s.sessions}</td>
                    <td className="py-2 text-right font-mono">{s.hours}h</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
