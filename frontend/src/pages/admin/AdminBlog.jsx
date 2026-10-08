import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, fmtDate, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { RichEditor } from "@/components/RichEditor";
import { AdminHeader, Table, Modal } from "./AdminLayout";

const blank = { title: "", excerpt: "", content: "", cover_url: "", published: false, tags: [] };

export default function AdminBlog() {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/admin/posts").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (edit.id) await api.put(`/admin/posts/${edit.id}`, edit); else await api.post("/admin/posts", edit);
      toast.success("Post saved"); setEdit(null); load();
    } catch (ex) { toast.error(errMsg(ex)); }
  };

  if (!rows) return <Spinner />;
  return (
    <div data-testid="admin-blog">
      <AdminHeader title="Blog & announcements" sub="Articles and news for your students." right={<button onClick={() => setEdit(blank)} className="btn-gold !py-2.5" data-testid="new-post-btn"><Plus size={16} /> New post</button>} />
      <Table cols={["Title", "Tags", "Status", "Published", ""]} rows={rows} testId="posts-table"
        render={(p) => (
          <tr key={p.id} data-testid={`post-row-${p.id}`}>
            <td className="px-4 py-3 font-medium">{p.title}</td>
            <td className="px-4 py-3"><div className="flex gap-1 flex-wrap">{p.tags.map((t) => <span key={t} className="gold-badge !py-0">{t}</span>)}</div></td>
            <td className="px-4 py-3"><span className={`gold-badge ${p.published ? "!bg-emerald-50 !text-emerald-800 !border-emerald-200" : ""}`}>{p.published ? "Published" : "Draft"}</span></td>
            <td className="px-4 py-3 text-slate-500">{fmtDate(p.published_at)}</td>
            <td className="px-4 py-3 text-right whitespace-nowrap"><button onClick={() => setEdit(p)} className="p-2 text-slate-400 hover:text-[#0A192F]" data-testid={`edit-post-${p.id}`}><Pencil size={15} /></button><button onClick={async () => { if (window.confirm("Delete post?")) { await api.delete(`/admin/posts/${p.id}`); load(); } }} className="p-2 text-slate-400 hover:text-red-600" data-testid={`delete-post-${p.id}`}><Trash2 size={15} /></button></td>
          </tr>
        )} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit post" : "New post"} wide>
        {edit && (
          <form onSubmit={save} className="space-y-4">
            <div><label className="label-lux">Title</label><input required className="input-lux" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} data-testid="post-title-input" /></div>
            <div><label className="label-lux">Excerpt</label><textarea rows={2} className="input-lux" value={edit.excerpt} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} data-testid="post-excerpt-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-lux">Cover image URL</label><input className="input-lux" value={edit.cover_url} onChange={(e) => setEdit({ ...edit, cover_url: e.target.value })} /></div>
              <div><label className="label-lux">Tags (comma sep.)</label><input className="input-lux" value={edit.tags.join(", ")} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
            </div>
            <div><label className="label-lux">Content</label><RichEditor value={edit.content} onChange={(v) => setEdit({ ...edit, content: v })} testId="post-content-editor" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} className="accent-amber-500" data-testid="post-published-toggle" /> Published</label>
            <button className="btn-gold w-full" data-testid="post-submit-btn">Save post</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
