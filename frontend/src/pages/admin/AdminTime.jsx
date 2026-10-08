import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, fmtDate, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader } from "./AdminLayout";

const hrs = (m) => `${(m / 60).toFixed(1)}h`;
const TABS = [["all", "All"], ["client", "Clients"], ["student", "Students"], ["internal", "Internal"]];

export default function AdminTime() {
  const [tab, setTab] = useState("all");
  const [entries, setEntries] = useState(null);
  const [summary, setSummary] = useState(null);

  const load = () => {
    const params = tab === "all" ? {} : { subject_type: tab };
    api.get("/admin/time/entries", { params }).then((r) => setEntries(r.data));
    api.get("/admin/time/summary").then((r) => setSummary(r.data));
  };
  useEffect(() => { load(); }, [tab]); // eslint-disable-line
  useEffect(() => { const h = () => load(); window.addEventListener("time-updated", h); return () => window.removeEventListener("time-updated", h); }); // eslint-disable-line

  const del = async (id) => { if (!window.confirm("Delete entry?")) return; await api.delete(`/admin/time/entries/${id}`); toast.success("Deleted"); load(); };

  if (!entries || !summary) return <Spinner />;

  const groups = {};
  entries.forEach((e) => { const d = (e.started_at || "").slice(0, 10); (groups[d] = groups[d] || []).push(e); });

  return (
    <div data-testid="admin-time">
      <AdminHeader title="Time" sub="Toggl-style tracking across clients, students and internal work" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6" data-testid="time-summary">
        {[["Total", summary.total_minutes], ["Clients", summary.by_subject.client], ["Students", summary.by_subject.student], ["Internal", summary.by_subject.internal], ["Billable", summary.billable.billable]].map(([l, m]) => (
          <div key={l} className="card-lux p-4"><div className="eyebrow">{l}</div><div className="font-serif text-2xl text-[#0A192F] mt-1">{hrs(m)}</div></div>
        ))}
      </div>

      <div className="flex gap-2 mb-5">
        {TABS.map(([id, label]) => <button key={id} onClick={() => setTab(id)} data-testid={`time-tab-${id}`} className={`px-4 py-2 text-sm rounded-lg ${tab === id ? "bg-[#0A192F] text-amber-300" : "text-slate-600 hover:bg-stone-100"}`}>{label}</button>)}
      </div>

      {Object.keys(groups).length === 0 ? <div className="text-slate-400 text-sm py-12 text-center">No time entries yet. Use the timer bar above to start tracking.</div> : (
        Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])).map(([day, list]) => (
          <div key={day} className="mb-6">
            <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"><span>{fmtDate(day)}</span><span>{hrs(list.reduce((s, e) => s + e.duration_minutes, 0))}</span></div>
            <div className="card-lux divide-y divide-slate-100">
              {list.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm" data-testid={`time-entry-${e.id}`}>
                  <span className={`w-1.5 h-8 rounded-full ${e.subject_type === "client" ? "bg-amber-500" : e.subject_type === "student" ? "bg-[#0A192F]" : "bg-slate-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-slate-800">{e.description || e.category || "—"}</div>
                    <div className="text-xs text-slate-400">{e.category} · {e.subject_type}{e.billable ? " · billable" : ""}</div>
                  </div>
                  <span className="font-mono text-slate-700">{hrs(e.duration_minutes)}</span>
                  <button onClick={() => del(e.id)} className="text-red-500" data-testid={`time-delete-${e.id}`}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {summary.by_category.length > 0 && (
        <div className="card-lux p-6 mt-8">
          <div className="eyebrow mb-3">Hours by category</div>
          <div className="space-y-1.5">
            {summary.by_category.map((c) => <div key={c.category} className="flex justify-between text-sm"><span className="text-slate-600">{c.category}</span><span className="font-mono text-slate-800">{hrs(c.minutes)}</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
