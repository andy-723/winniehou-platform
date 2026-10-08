import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader, Table } from "./AdminLayout";

export default function AdminCourses() {
  const [rows, setRows] = useState(null);
  const nav = useNavigate();
  const load = () => api.get("/admin/courses").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      const { data } = await api.post("/admin/courses", { title: "Untitled course", level: "Intermediate", price: 9900 });
      nav(`/admin/courses/${data.id}`);
    } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (c) => {
    if (!window.confirm(`Delete "${c.title}"? This cannot be undone.`)) return;
    await api.delete(`/admin/courses/${c.id}`); toast.success("Course deleted"); load();
  };

  if (!rows) return <Spinner />;
  return (
    <div data-testid="admin-courses">
      <AdminHeader title="Courses" sub="Create, edit and publish your curriculum." right={<button onClick={create} className="btn-gold !py-2.5" data-testid="new-course-btn"><Plus size={16} /> New course</button>} />
      <Table cols={["Course", "Level", "Price", "Lessons", "Students", "Status", ""]} rows={rows} testId="admin-courses-table"
        render={(c) => (
          <tr key={c.id} data-testid={`admin-course-row-${c.id}`}>
            <td className="px-4 py-3"><div className="flex items-center gap-3"><img src={c.thumbnail_url || "https://placehold.co/80x50/0A192F/D4AF37?text=+"} alt="" className="w-14 h-9 object-cover rounded bg-stone-100" /><Link to={`/admin/courses/${c.id}`} className="font-medium hover:text-amber-700">{c.title}</Link></div></td>
            <td className="px-4 py-3 text-slate-500">{c.level}</td>
            <td className="px-4 py-3">{fmt(c.price)}</td>
            <td className="px-4 py-3 text-slate-500">{c.modules.reduce((s, m) => s + m.lessons.length, 0)}</td>
            <td className="px-4 py-3 text-slate-500">{c.enrollments}</td>
            <td className="px-4 py-3"><span className={`gold-badge ${c.published ? "!bg-emerald-50 !text-emerald-800 !border-emerald-200" : ""}`}>{c.published ? "Published" : "Draft"}</span></td>
            <td className="px-4 py-3 text-right whitespace-nowrap"><Link to={`/admin/courses/${c.id}`} className="p-2 inline-block text-slate-400 hover:text-[#0A192F]" data-testid={`edit-course-${c.id}`}><Pencil size={15} /></Link><button onClick={() => del(c)} className="p-2 text-slate-400 hover:text-red-600" data-testid={`delete-course-${c.id}`}><Trash2 size={15} /></button></td>
          </tr>
        )} />
    </div>
  );
}
