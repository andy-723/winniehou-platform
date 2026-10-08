import { useEffect, useState } from "react";
import { Search, Ban, CheckCircle, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, fmtDate, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader, Table, Modal } from "./AdminLayout";

export default function AdminStudents() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [courses, setCourses] = useState([]);
  const [grant, setGrant] = useState("");

  const load = () => api.get("/admin/students", { params: q ? { q } : {} }).then((r) => setRows(r.data));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line
  useEffect(() => { api.get("/admin/courses").then((r) => setCourses(r.data)); }, []);

  const openStudent = async (u) => { const { data } = await api.get(`/admin/students/${u.id}`); setSel(data); };
  const patch = async (body, msg) => {
    try { await api.patch(`/admin/students/${sel.id}`, body); toast.success(msg); openStudent(sel); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  if (!rows) return <Spinner />;
  return (
    <div data-testid="admin-students">
      <AdminHeader title="Students" sub={`${rows.length} accounts`} right={
        <div className="relative w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="input-lux !pl-9" data-testid="student-search" /></div>} />
      <Table cols={["Student", "Joined", "Courses", "Spent", "Devices", "Status"]} rows={rows} testId="students-table"
        render={(u) => (
          <tr key={u.id} onClick={() => openStudent(u)} className="cursor-pointer hover:bg-stone-50" data-testid={`student-row-${u.id}`}>
            <td className="px-4 py-3"><div className="font-medium">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></td>
            <td className="px-4 py-3 text-slate-500">{fmtDate(u.created_at)}</td>
            <td className="px-4 py-3">{u.enrollments}</td><td className="px-4 py-3">{fmt(u.spent)}</td><td className="px-4 py-3">{u.sessions}/2</td>
            <td className="px-4 py-3">{u.disabled ? <span className="gold-badge !bg-red-50 !text-red-700 !border-red-200">Disabled</span> : <span className="gold-badge !bg-emerald-50 !text-emerald-800 !border-emerald-200">Active</span>}</td>
          </tr>
        )} />

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.name} wide>
        {sel && (
          <div className="space-y-6 text-sm">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => patch({ disabled: !sel.disabled }, sel.disabled ? "Account enabled" : "Account disabled")} className="btn-outline !py-2 !text-xs" data-testid="toggle-disable-btn">{sel.disabled ? <><CheckCircle size={14} /> Enable</> : <><Ban size={14} /> Disable</>}</button>
              <button onClick={() => patch({ clear_sessions: true }, "All devices signed out")} className="btn-outline !py-2 !text-xs" data-testid="clear-sessions-btn"><LogOut size={14} /> Sign out all devices ({sel.sessions.length})</button>
            </div>
            <div>
              <div className="eyebrow mb-2">Enrollments</div>
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
              <div className="eyebrow mb-2">Orders</div>
              <ul className="divide-y border rounded-lg">{sel.orders.map((o) => <li key={o.id} className="flex justify-between px-3 py-2"><span className="font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</span><span>{fmt(o.total)}</span><span className="gold-badge">{o.status}</span></li>)}{sel.orders.length === 0 && <li className="px-3 py-3 text-slate-400">No orders</li>}</ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
