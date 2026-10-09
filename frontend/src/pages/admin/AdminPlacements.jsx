import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Upload } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { AdminHeader, Table, Modal } from "./AdminLayout";

const blank = { name: "", logo_url: "", alt: "", sort_order: 0, confirmed: false, published: false };

export default function AdminPlacements() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/admin/placements").then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const upload = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("scope", "public");
    try {
      const { data } = await api.post("/admin/upload", fd);
      setEdit((cur) => ({ ...cur, logo_url: data.url }));
      toast.success("Logo uploaded");
    } catch (e) { toast.error(errMsg(e)); }
  };

  const save = async () => {
    try {
      const body = { ...edit, sort_order: Number(edit.sort_order) || 0 };
      if (edit.id) await api.put(`/admin/placements/${edit.id}`, body);
      else await api.post("/admin/placements", body);
      toast.success("Saved");
      setEdit(null);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this placement?")) return;
    await api.delete(`/admin/placements/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div data-testid="admin-placements">
      <AdminHeader title="Client placements" sub="A logo is shown on the homepage only after it is confirmed and published, and only once at least three qualify." right={<button className="btn-navy" onClick={() => setEdit({ ...blank })} data-testid="placement-new">Add placement</button>} />
      <Table cols={["Company", "Logo", "Order", "Confirmed", "Published", ""]} rows={rows} testId="placements-table" render={(p) => (
        <tr key={p.id}>
          <td className="px-4 py-3 font-medium">{p.name}</td>
          <td className="px-4 py-3">{p.logo_url ? <img src={p.logo_url} alt="" className="h-6 w-auto" /> : <span className="text-slate-400 text-xs">No file</span>}</td>
          <td className="px-4 py-3">{p.sort_order}</td>
          <td className="px-4 py-3">{p.confirmed ? "Yes" : "No"}</td>
          <td className="px-4 py-3">{p.published ? "Yes" : "No"}</td>
          <td className="px-4 py-3 text-right whitespace-nowrap">
            <button onClick={() => setEdit(p)} className="p-2 text-slate-400 hover:text-[#0A192F]" data-testid={`edit-placement-${p.sort_order}`}><Pencil size={15} /></button>
            <button onClick={() => del(p.id)} className="p-2 text-slate-400 hover:text-red-600" data-testid={`delete-placement-${p.sort_order}`}><Trash2 size={15} /></button>
          </td>
        </tr>
      )} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit placement" : "New placement"}>
        {edit && (
          <div className="space-y-4">
            <label className="block">Company<input className="input-lux mt-1" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-testid="placement-name" /></label>
            <div>
              <div className="label-lux">Logo file</div>
              {edit.logo_url ? <img src={edit.logo_url} alt="" className="h-10 mb-2" /> : <p className="text-xs text-slate-400 mb-2">No logo yet. Use the official file. The site turns it to one ivory tone.</p>}
              <label className="btn-outline cursor-pointer !py-2"><Upload size={14} /> Upload SVG or PNG<input type="file" accept="image/svg+xml,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} data-testid="placement-logo" /></label>
            </div>
            <label className="block">Alt text<input className="input-lux mt-1" value={edit.alt || ""} onChange={(e) => setEdit({ ...edit, alt: e.target.value })} data-testid="placement-alt" /></label>
            <label className="block">Sort order<input className="input-lux mt-1" type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} data-testid="placement-order" /></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={!!edit.confirmed} onChange={(e) => setEdit({ ...edit, confirmed: e.target.checked })} className="mt-1" data-testid="placement-confirmed" /> Winnie has confirmed a real client placement here</label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={!!edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} className="mt-1" data-testid="placement-published" /> Published</label>
            <button className="btn-navy w-full" onClick={save} data-testid="placement-save">Save</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
