import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Upload } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { AdminHeader, Table, Modal } from "./AdminLayout";

const blank = { title: "", left_label: "", right_label: "", image_url: "", alt: "", sort_order: 0, published: false };

export default function AdminIndustries() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/admin/industry-panels").then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const upload = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("scope", "public");
    try {
      const { data } = await api.post("/admin/upload", fd);
      setEdit((cur) => ({ ...cur, image_url: data.url }));
      toast.success("Image uploaded");
    } catch (e) { toast.error(errMsg(e)); }
  };

  const save = async () => {
    try {
      const body = { ...edit, sort_order: Number(edit.sort_order) || 0 };
      if (edit.id) await api.put(`/admin/industry-panels/${edit.id}`, body);
      else await api.post("/admin/industry-panels", body);
      toast.success("Saved");
      setEdit(null);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this panel?")) return;
    await api.delete(`/admin/industry-panels/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div data-testid="admin-industries">
      <AdminHeader title="Industry panels" sub="A panel is public only after it is published and has a background image. The right label should name employers that match a confirmed client placement. Left labels are placeholders." right={<button className="btn-navy" onClick={() => setEdit({ ...blank })} data-testid="industry-new">Add panel</button>} />
      <Table cols={["Title", "Left", "Right", "Image", "Order", "Published", ""]} rows={rows} testId="industries-table" render={(p) => (
        <tr key={p.id}>
          <td className="px-4 py-3 font-medium">{p.title}</td>
          <td className="px-4 py-3 text-slate-600">{p.left_label}</td>
          <td className="px-4 py-3">{p.right_label}</td>
          <td className="px-4 py-3">{p.image_url ? "Yes" : <span className="text-slate-400">No file</span>}</td>
          <td className="px-4 py-3">{p.sort_order}</td>
          <td className="px-4 py-3">{p.published ? "Yes" : "No"}</td>
          <td className="px-4 py-3 text-right whitespace-nowrap">
            <button onClick={() => setEdit(p)} className="p-2 text-slate-400 hover:text-[#0A192F]" data-testid={`edit-industry-${p.sort_order}`}><Pencil size={15} /></button>
            <button onClick={() => del(p.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
          </td>
        </tr>
      )} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit panel" : "New panel"}>
        {edit && (
          <div className="space-y-4">
            <label className="block">Title<input className="input-lux mt-1" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} data-testid="industry-title" /></label>
            <label className="block">Left label<input className="input-lux mt-1" value={edit.left_label || ""} onChange={(e) => setEdit({ ...edit, left_label: e.target.value })} data-testid="industry-left" /></label>
            <label className="block">Right label<input className="input-lux mt-1" value={edit.right_label || ""} onChange={(e) => setEdit({ ...edit, right_label: e.target.value })} data-testid="industry-right" /></label>
            <div>
              <div className="label-lux">Background image</div>
              {edit.image_url ? <img src={edit.image_url} alt="" className="h-28 w-full object-cover mb-2 bg-[#0A192F]" /> : <p className="text-xs text-slate-400 mb-2">No image yet. The homepage hides this panel until one is uploaded.</p>}
              <label className="btn-outline cursor-pointer !py-2"><Upload size={14} /> Upload<input type="file" accept="image/webp,image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} data-testid="industry-image" /></label>
            </div>
            <label className="block">Alt text<input className="input-lux mt-1" value={edit.alt || ""} onChange={(e) => setEdit({ ...edit, alt: e.target.value })} data-testid="industry-alt" /></label>
            <label className="block">Sort order<input className="input-lux mt-1" type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} data-testid="industry-order" /></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={!!edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} className="mt-1" data-testid="industry-published" /> Published</label>
            <button className="btn-navy w-full" onClick={save} data-testid="industry-save">Save</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
