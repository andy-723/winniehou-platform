import { useEffect, useState } from "react";
import { Search, Ban, CheckCircle, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, fmtDate, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader, Table, Modal } from "./AdminLayout";

const STATUS = {
  active: { label: "Active", cls: "!bg-emerald-50 !text-emerald-800 !border-emerald-200" },
  at_risk: { label: "At risk", cls: "!bg-amber-50 !text-amber-800 !border-amber-200" },
  completed: { label: "Completed", cls: "!bg-sky-50 !text-sky-800 !border-sky-200" },
};
const StatusBadge = ({ s }) => { const m = STATUS[s] || STATUS.active; return <span className={`gold-badge ${m.cls}`}>{m.label}</span>; };
const Bar = ({ pct }) => (
  <div className="flex items-center gap-2 min-w-[90px]">
    <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
    <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
  </div>
);

export default function AdminStudents() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(null);
  const [courses, setCourses] = useState([]);
  const [grant, setGrant] = useState("");
  const [notes, setNotes] = useState("");

  const load = () => api.get("/admin/students", { params: q ? { q } : {} }).then((r) => setRows(r.data));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line
  useEffect(() => { api.get("/admin/courses").then((r) => setCourses(r.data)); }, []);

  const openStudent = async (u) => { const { data } = await api.get(`/admin/students/${u.id}`); setSel(data); setNotes(data.admin_notes || ""); };
  const patch = async (body, msg) => {
    try { await api.patch(`/admin/students/${sel.id}`, body); toast.success(msg); const { data } = await api.get(`/admin/students/${sel.id}`); setSel(data); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  if (!rows) return <Spinner />;
  const counts = { all: rows.length, active: 0, at_risk: 0, completed: 0 };
  rows.forEach((u) => { counts[u.status] = (counts[u.status] || 0) + 1; });
  const shown = filter === "all" ? rows : rows.filter((u) => u.status === filter);
  const Filter = ({ id, label }) => <button onClick={() => setFilter(id)} data-testid={`status-filter-${id}`} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${filter === id ? "bg-[#0A192F] text-amber-300" : "text-slate-600 hover:bg-stone-100"}`}>{label} ({counts[id] || 0})</button>;

  return (
    <div data-testid="admin-students">
      <AdminHeader title="Students" sub={`${rows.length} accounts`} right={
        <div className="relative w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="input-lux !pl-9" data-testid="student-search" /></div>} />

      <div className="flex gap-2 mb-4"><Filter id="all" label="All" /><Filter id="active" label="Active" /><Filter id="at_risk" label="At risk" /><Filter id="completed" label="Completed" /></div>

      <Table cols={["Student", "Joined", "Courses", "Progress", "Lessons", "Last active", "Spent", "Devices", "Status"]} rows={shown} testId="students-table"
        render={(u) => (
          <tr key={u.id} onClick={() => openStudent(u)} className="cursor-pointer hover:bg-stone-50" data-testid={`student-row-${u.id}`}>
            <td className="px-4 py-3"><div className="font-medium">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></td>
            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(u.created_at)}</td>
            <td className="px-4 py-3">{u.enrollments}</td>
            <td className="px-4 py-3"><Bar pct={u.progress_percent || 0} /></td>
            <td className="px-4 py-3">{u.lessons_completed || 0}</td>
            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{u.last_active ? fmtDate(u.last_active) : "—"}</td>
            <td className="px-4 py-3">{fmt(u.spent)}</td>
            <td className="px-4 py-3">{u.sessions}/2</td>
            <td className="px-4 py-3"><StatusBadge s={u.status} /></td>
          </tr>
        )} />

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.name} wide>
        {sel && (
          <div className="space-y-6 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="student-metrics">
              <div className="card-lux p-3"><div className="eyebrow">Progress</div><div className="font-serif text-2xl text-[#0A192F]">{sel.metrics.percent}%</div></div>
              <div className="card-lux p-3"><div className="eyebrow">Lessons done</div><div className="font-serif text-2xl text-[#0A192F]">{sel.metrics.lessons_completed}/{sel.metrics.lessons_total}</div></div>
              <div className="card-lux p-3"><div className="eyebrow">Last active</div><div className="text-sm mt-2">{sel.metrics.last_active ? fmtDate(sel.metrics.last_active) : "—"}</div></div>
              <div className="card-lux p-3"><div className="eyebrow">Status</div><div className="mt-2"><StatusBadge s={sel.metrics.status} /></div></div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => patch({ disabled: !sel.disabled }, sel.disabled ? "Account enabled" : "Account disabled")} className="btn-outline !py-2 !text-xs" data-testid="toggle-disable-btn">{sel.disabled ? <><CheckCircle size={14} /> Enable</> : <><Ban size={14} /> Disable</>}</button>
              <button onClick={() => patch({ clear_sessions: true }, "All devices signed out")} className="btn-outline !py-2 !text-xs" data-testid="clear-sessions-btn"><LogOut size={14} /> Sign out all devices ({sel.sessions.length})</button>
            </div>

            <div>
              <div className="eyebrow mb-2">Course progress</div>
              <div className="space-y-4">
                {sel.metrics.per_course.length === 0 && <div className="text-slate-400">No enrollments</div>}
                {sel.metrics.per_course.map((c) => (
                  <div key={c.course_id} className="border rounded-lg p-3" data-testid={`course-progress-${c.course_id}`}>
                    <div className="flex justify-between items-center mb-2"><span className="font-medium">{c.course_title}</span><span className="text-xs text-slate-500">{c.completed}/{c.total} lessons</span></div>
                    <Bar pct={c.percent} />
                    <div className="mt-3 space-y-1.5">
                      {c.modules.map((m) => (
                        <div key={m.module_id} className="flex items-center gap-2 text-xs"><span className="w-40 truncate text-slate-600">{m.title}</span><div className="flex-1 h-1 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${m.percent}%` }} /></div><span className="w-10 text-right text-slate-400">{m.completed}/{m.total}</span></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="eyebrow mb-2">Manage access</div>
              <ul className="divide-y border rounded-lg">
                {sel.enrollments.map((e) => <li key={e.course_id} className="flex justify-between items-center px-3 py-2"><span>{e.course_title}</span><div className="flex items-center gap-3"><span className={`gold-badge ${!e.active ? "opacity-50" : ""}`}>{e.active ? "active" : "revoked"}</span>{e.active && <button onClick={() => patch({ revoke_course_id: e.course_id }, "Access revoked")} className="text-xs text-red-600 hover:underline">Revoke</button>}</div></li>)}
                {sel.enrollments.length === 0 && <li className="px-3 py-3 text-slate-400">No enrollments</li>}
              </ul>
              <div className="flex gap-2 mt-3">
                <select className="input-lux" value={grant} onChange={(e) => setGrant(e.target.value)} data-testid="grant-course-select"><option value="">Grant free access to…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
                <button disabled={!grant} onClick={() => patch({ grant_course_id: grant }, "Access granted")} className="btn-navy !py-2 !text-xs shrink-0 disabled:opacity-50" data-testid="grant-course-btn"><Plus size={14} /> Grant</button>
              </div>
            </div>

            <div>
              <div className="eyebrow mb-2">Activity timeline</div>
              <ul className="space-y-2" data-testid="activity-timeline">
                {sel.timeline.length === 0 && <li className="text-slate-400">No activity yet</li>}
                {sel.timeline.map((ev, i) => (
                  <li key={i} className="flex gap-3 text-xs"><span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${ev.type === "purchase" ? "bg-emerald-500" : "bg-amber-500"}`} /><span className="flex-1">{ev.label}</span><span className="text-slate-400 whitespace-nowrap">{fmtDate(ev.at)}</span></li>
                ))}
              </ul>
            </div>

            <div>
              <div className="eyebrow mb-2">Orders</div>
              <ul className="divide-y border rounded-lg">{sel.orders.map((o) => <li key={o.id} className="flex justify-between px-3 py-2"><span className="font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</span><span>{fmt(o.total)}</span><span className="gold-badge">{o.status}</span></li>)}{sel.orders.length === 0 && <li className="px-3 py-3 text-slate-400">No orders</li>}</ul>
            </div>

            <div>
              <div className="eyebrow mb-2">Admin notes</div>
              <textarea className="input-lux" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Private notes about this student…" data-testid="admin-notes" />
              <button onClick={() => patch({ notes }, "Notes saved")} className="btn-gold !py-2 !text-xs mt-2" data-testid="save-notes-btn">Save notes</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
