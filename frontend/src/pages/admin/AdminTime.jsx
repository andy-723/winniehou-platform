import { useEffect, useState } from "react";
import { Trash2, Pencil, Play, Plus, Download, List, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { api, fmtDate, fmt, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader, Modal } from "./AdminLayout";

const hrs = (m) => `${(m / 60).toFixed(1)}h`;
const TABS = [["all", "All"], ["client", "Clients"], ["student", "Students"], ["prospect", "Prospects"], ["internal", "Internal"]];

const addMinutes = (t, mins) => {
  const [h, m] = t.split(":").map(Number);
  const total = h * 60 + m + Number(mins);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const mondayOfThisWeek = () => {
  const base = new Date();
  const day = (base.getDay() + 6) % 7;
  const mon = new Date(base);
  mon.setDate(base.getDate() - day);
  return mon;
};

const emptyForm = { date: new Date().toISOString().slice(0, 10), start_time: "09:00", end_time: "", duration_min: "", subject_type: "client", student_id: "", client_id: "", engagement_id: "", category: "", description: "", billable: true };

export default function AdminTime() {
  const [tab, setTab] = useState("all");
  const [view, setView] = useState("list");
  const [entries, setEntries] = useState(null);
  const [summary, setSummary] = useState(null);
  const [cats, setCats] = useState([]);
  const [clients, setClients] = useState([]);
  const [students, setStudents] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [profit, setProfit] = useState([]);
  const [filters, setFilters] = useState({ date_from: "", date_to: "", category: "", billable: "" });
  const [form, setForm] = useState(null); // {editing_id?, ...fields}

  const load = () => {
    const params = {};
    if (tab !== "all") params.subject_type = tab;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.category) params.category = filters.category;
    if (filters.billable) params.billable = filters.billable === "yes";
    api.get("/admin/time/entries", { params }).then((r) => setEntries(r.data));
    api.get("/admin/time/summary", { params: { date_from: filters.date_from || undefined, date_to: filters.date_to || undefined } }).then((r) => setSummary(r.data));
    api.get("/admin/time/profitability").then((r) => setProfit(r.data));
  };
  useEffect(() => { load(); }, [tab, filters]); // eslint-disable-line
  useEffect(() => {
    api.get("/admin/time/categories").then((r) => setCats(r.data));
    api.get("/admin/clients").then((r) => setClients(r.data));
    api.get("/admin/students").then((r) => setStudents(r.data));
    api.get("/admin/prospects").then((r) => setProspects(r.data.prospects));
  }, []);
  useEffect(() => { const h = () => load(); window.addEventListener("time-updated", h); return () => window.removeEventListener("time-updated", h); }); // eslint-disable-line

  const clientName = (id) => { const c = clients.find((x) => x.id === id); return c ? `${c.first_name} ${c.last_name}`.trim() : "Client"; };
  const studentName = (id) => { const s = students.find((x) => x.id === id); return s ? s.name : "Student"; };
  const prospectName = (id) => { const p = prospects.find((x) => x.id === id); return p ? `${p.first_name} ${p.last_name}`.trim() : "Prospect"; };
  const subjName = (e) => e.subject_type === "client" ? clientName(e.client_id) : e.subject_type === "student" ? studentName(e.student_id) : e.subject_type === "prospect" ? prospectName(e.prospect_id) : "Internal";

  const del = async (id) => { if (!window.confirm("Delete entry?")) return; await api.delete(`/admin/time/entries/${id}`); toast.success("Deleted"); load(); };

  const cont = (e) => window.dispatchEvent(new CustomEvent("start-timer", { detail: {
    subject_type: e.subject_type, description: e.description, category: e.category, billable: e.billable,
    student_id: e.student_id || undefined, client_id: e.client_id || undefined, engagement_id: e.engagement_id || undefined,
  } }));

  const openEdit = (e) => setForm({
    editing_id: e.id, date: (e.started_at || "").slice(0, 10), start_time: (e.started_at || "").slice(11, 16),
    end_time: (e.ended_at || "").slice(11, 16), duration_min: "", subject_type: e.subject_type,
    student_id: e.student_id || "", client_id: e.client_id || "", engagement_id: e.engagement_id || "",
    category: e.category || "", description: e.description || "", billable: !!e.billable,
  });

  const saveForm = async () => {
    const f = form;
    let end = f.end_time;
    if (!end && f.duration_min) end = addMinutes(f.start_time || "09:00", f.duration_min);
    if (!end) { toast.error("Enter an end time or duration"); return; }
    if (f.subject_type === "student" && !f.student_id) { toast.error("Pick a student"); return; }
    if (f.subject_type === "client" && (!f.client_id || !f.engagement_id)) { toast.error("Pick a client and engagement"); return; }
    const body = { subject_type: f.subject_type, description: f.description, category: f.category, billable: f.billable,
      started_at: `${f.date}T${f.start_time || "09:00"}:00`, ended_at: `${f.date}T${end}:00` };
    if (f.subject_type === "student") body.student_id = f.student_id;
    if (f.subject_type === "client") { body.client_id = f.client_id; body.engagement_id = f.engagement_id; }
    try {
      if (f.editing_id) await api.put(`/admin/time/entries/${f.editing_id}`, body);
      else await api.post("/admin/time/entries", body);
      toast.success("Saved"); setForm(null); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const exportCsv = () => {
    const head = ["Date", "Start", "End", "Subject", "Name", "Category", "Description", "Minutes", "Billable"];
    const lines = [head.join(",")];
    entries.forEach((e) => lines.push([
      (e.started_at || "").slice(0, 10), (e.started_at || "").slice(11, 16), (e.ended_at || "").slice(11, 16),
      e.subject_type, `"${subjName(e)}"`, `"${e.category || ""}"`, `"${(e.description || "").replace(/"/g, "'")}"`,
      e.duration_minutes, e.billable ? "yes" : "no",
    ].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `time-entries-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  if (!entries || !summary) return <Spinner />;

  const groups = {};
  entries.forEach((e) => { const d = (e.started_at || "").slice(0, 10); (groups[d] = groups[d] || []).push(e); });

  // week view aggregation
  const mon = mondayOfThisWeek();
  const weekDates = [...Array(7)].map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d.toISOString().slice(0, 10); });
  const weekRows = {};
  entries.forEach((e) => {
    const d = (e.started_at || "").slice(0, 10);
    if (!weekDates.includes(d)) return;
    const key = e.subject_type === "client" ? `client:${e.client_id}` : e.subject_type === "student" ? `student:${e.student_id}` : "internal";
    const label = subjName(e);
    weekRows[key] = weekRows[key] || { label, type: e.subject_type, client_id: e.client_id, student_id: e.student_id, engagement_id: e.engagement_id, days: {} };
    weekRows[key].days[d] = (weekRows[key].days[d] || 0) + e.duration_minutes;
  });

  const openCellAdd = (row, date) => setForm({ ...emptyForm, date, subject_type: row.type, client_id: row.client_id || "", student_id: row.student_id || "", engagement_id: row.engagement_id || "" });

  const selClient = clients.find((c) => c.id === form?.client_id);

  return (
    <div data-testid="admin-time">
      <AdminHeader title="Time" sub="Toggl-style tracking across clients, students and internal work" right={
        <div className="flex gap-2">
          <button onClick={() => setForm({ ...emptyForm })} className="btn-navy !py-2 !text-sm" data-testid="add-entry-btn"><Plus size={15} /> Add entry</button>
          <button onClick={exportCsv} className="btn-outline !py-2 !text-sm" data-testid="export-csv-btn"><Download size={15} /> CSV</button>
        </div>} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6" data-testid="time-summary">
        {[["Total", summary.total_minutes], ["Clients", summary.by_subject.client], ["Students", summary.by_subject.student], ["Internal", summary.by_subject.internal], ["Billable", summary.billable.billable]].map(([l, m]) => (
          <div key={l} className="card-lux p-4"><div className="eyebrow">{l}</div><div className="font-serif text-2xl text-[#0A192F] mt-1">{hrs(m)}</div></div>
        ))}
      </div>

      {/* filters */}
      <div className="card-lux p-4 mb-5 flex flex-wrap items-end gap-3" data-testid="time-filters">
        <label className="text-xs text-slate-500">From<input type="date" className="input-lux !py-1.5 block mt-1" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} data-testid="filter-from" /></label>
        <label className="text-xs text-slate-500">To<input type="date" className="input-lux !py-1.5 block mt-1" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} data-testid="filter-to" /></label>
        <label className="text-xs text-slate-500">Category<select className="input-lux !py-1.5 block mt-1" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} data-testid="filter-category"><option value="">All</option>{[...new Set(cats.map((c) => c.name))].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="text-xs text-slate-500">Billable<select className="input-lux !py-1.5 block mt-1" value={filters.billable} onChange={(e) => setFilters({ ...filters, billable: e.target.value })} data-testid="filter-billable"><option value="">All</option><option value="yes">Billable</option><option value="no">Non-billable</option></select></label>
        {(filters.date_from || filters.date_to || filters.category || filters.billable) && <button onClick={() => setFilters({ date_from: "", date_to: "", category: "", billable: "" })} className="text-xs text-amber-700 underline" data-testid="filter-clear">Clear</button>}
      </div>

      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div className="flex gap-2">
          {TABS.map(([id, label]) => <button key={id} onClick={() => setTab(id)} data-testid={`time-tab-${id}`} className={`px-4 py-2 text-sm rounded-lg ${tab === id ? "bg-[#0A192F] text-amber-300" : "text-slate-600 hover:bg-stone-100"}`}>{label}</button>)}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          <button onClick={() => setView("list")} className={`px-3 py-2 text-sm inline-flex items-center gap-1.5 ${view === "list" ? "bg-[#0A192F] text-amber-300" : "text-slate-600"}`} data-testid="view-list"><List size={14} /> List</button>
          <button onClick={() => setView("week")} className={`px-3 py-2 text-sm inline-flex items-center gap-1.5 ${view === "week" ? "bg-[#0A192F] text-amber-300" : "text-slate-600"}`} data-testid="view-week"><CalendarDays size={14} /> Week</button>
        </div>
      </div>

      {view === "list" ? (
        Object.keys(groups).length === 0 ? <div className="text-slate-400 text-sm py-12 text-center">No time entries. Use the timer bar above or "Add entry".</div> : (
          Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])).map(([day, list]) => (
            <div key={day} className="mb-6">
              <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"><span>{fmtDate(day)}</span><span>{hrs(list.reduce((s, e) => s + e.duration_minutes, 0))}</span></div>
              <div className="card-lux divide-y divide-slate-100">
                {list.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm" data-testid={`time-entry-${e.id}`}>
                    <span className={`w-1.5 h-8 rounded-full ${e.subject_type === "client" ? "bg-amber-500" : e.subject_type === "student" ? "bg-[#0A192F]" : "bg-slate-300"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-slate-800">{e.description || e.category || "—"}</div>
                      <div className="text-xs text-slate-400">{subjName(e)} · {e.category || "no category"}{e.billable ? " · billable" : ""}</div>
                    </div>
                    <span className="font-mono text-slate-700">{hrs(e.duration_minutes)}</span>
                    <button onClick={() => cont(e)} className="text-amber-600 hover:text-amber-700" title="Continue" data-testid={`time-continue-${e.id}`}><Play size={14} /></button>
                    <button onClick={() => openEdit(e)} className="text-slate-500 hover:text-slate-700" title="Edit" data-testid={`time-edit-${e.id}`}><Pencil size={14} /></button>
                    <button onClick={() => del(e.id)} className="text-red-500" title="Delete" data-testid={`time-delete-${e.id}`}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )
      ) : (
        <div className="card-lux overflow-x-auto" data-testid="time-week">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="text-left px-4 py-3">Subject</th>{weekDates.map((d) => <th key={d} className="px-2 py-3 text-center">{new Date(d).toLocaleDateString("en-US", { weekday: "short" })}<div className="text-slate-400 font-normal">{d.slice(5)}</div></th>)}<th className="px-3 py-3 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(weekRows).length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No entries this week.</td></tr> :
                Object.entries(weekRows).map(([key, row]) => {
                  const total = Object.values(row.days).reduce((s, m) => s + m, 0);
                  return (
                    <tr key={key} data-testid={`week-row-${key}`}>
                      <td className="px-4 py-3"><span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${row.type === "client" ? "bg-amber-500" : row.type === "student" ? "bg-[#0A192F]" : "bg-slate-300"}`} />{row.label}</td>
                      {weekDates.map((d) => <td key={d} onClick={() => openCellAdd(row, d)} className="px-2 py-3 text-center font-mono text-slate-700 hover:bg-amber-50 cursor-pointer" title="Add entry" data-testid={`week-cell-${key}-${d}`}>{row.days[d] ? hrs(row.days[d]) : <span className="text-slate-300">·</span>}</td>)}
                      <td className="px-3 py-3 text-right font-mono font-semibold">{hrs(total)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {summary.by_category.length > 0 && (
        <div className="card-lux p-6 mt-8">
          <div className="eyebrow mb-3">Hours by category</div>
          <div className="space-y-1.5">
            {summary.by_category.map((c) => <div key={c.category} className="flex justify-between text-sm"><span className="text-slate-600">{c.category}</span><span className="font-mono text-slate-800">{hrs(c.minutes)}</span></div>)}
          </div>
        </div>
      )}

      {/* client profitability */}
      <div className="card-lux p-6 mt-8" data-testid="profitability">
        <div className="eyebrow mb-3">Client profitability (package price ÷ hours logged)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400"><tr><th className="text-left py-2">Client</th><th className="text-left py-2">Package</th><th className="text-right py-2">Price</th><th className="text-right py-2">Hours</th><th className="text-right py-2">Effective $/h</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {profit.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-slate-400">No engagements yet.</td></tr> :
                profit.map((p) => (
                  <tr key={p.engagement_id} data-testid={`profit-${p.engagement_id}`}>
                    <td className="py-2">{p.client}</td>
                    <td className="py-2 text-slate-600">{p.package}</td>
                    <td className="py-2 text-right font-mono">{fmt(p.price_cents, "AUD")}</td>
                    <td className="py-2 text-right font-mono">{p.hours}h</td>
                    <td className="py-2 text-right font-mono text-[#0A192F] font-semibold">{p.rate != null ? fmt(p.rate * 100, "AUD") : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* add / edit entry modal */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.editing_id ? "Edit entry" : "Add entry"}>
        {form && (
          <div className="space-y-3 text-sm" data-testid="entry-form">
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-slate-500 col-span-3 sm:col-span-1">Date<input type="date" className="input-lux block mt-1" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="form-date" /></label>
              <label className="text-xs text-slate-500">Start<input type="time" className="input-lux block mt-1" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} data-testid="form-start" /></label>
              <label className="text-xs text-slate-500">End<input type="time" className="input-lux block mt-1" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} data-testid="form-end" /></label>
            </div>
            <label className="text-xs text-slate-500 block">Or duration (minutes)<input type="number" className="input-lux block mt-1" placeholder="e.g. 60" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} data-testid="form-duration" /></label>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 w-fit">
              {["client", "student", "internal"].map((s) => <button key={s} onClick={() => setForm({ ...form, subject_type: s, student_id: "", client_id: "", engagement_id: "" })} className={`px-3 py-1.5 text-xs capitalize ${form.subject_type === s ? "bg-[#0A192F] text-amber-300" : "text-slate-600"}`} data-testid={`form-subject-${s}`}>{s}</button>)}
            </div>
            {form.subject_type === "student" && (
              <select className="input-lux" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} data-testid="form-student"><option value="">Pick student…</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.email}</option>)}</select>
            )}
            {form.subject_type === "client" && (
              <div className="grid grid-cols-2 gap-3">
                <select className="input-lux" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value, engagement_id: "" })} data-testid="form-client"><option value="">Pick client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select>
                <select className="input-lux" value={form.engagement_id} onChange={(e) => setForm({ ...form, engagement_id: e.target.value })} data-testid="form-engagement"><option value="">Engagement…</option>{(selClient?.engagements || []).map((en) => <option key={en.id} value={en.id}>{en.service_package_key}</option>)}</select>
              </div>
            )}
            <select className="input-lux" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="form-category"><option value="">Category…</option>{cats.filter((c) => c.subject_type === form.subject_type).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
            <input className="input-lux" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="form-desc" />
            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} data-testid="form-billable" /> Billable</label>
            <button onClick={saveForm} className="btn-gold w-full" data-testid="form-save">{form.editing_id ? "Save changes" : "Add entry"}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
