import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader, Table, Modal } from "./AdminLayout";

const blank = { title: "", description: "", price: 1900, image_url: "", file_id: "", file_name: "", active: true, kind: "workbook" };

export default function AdminProducts() {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/admin/products").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = { ...edit, price: Number(edit.price) };
    try {
      if (edit.id) await api.put(`/admin/products/${edit.id}`, body); else await api.post("/admin/products", body);
      toast.success("Product saved"); setEdit(null); load();
    } catch (ex) { toast.error(errMsg(ex)); }
  };

  const upload = async (file, kind) => {
    const fd = new FormData(); fd.append("file", file); fd.append("scope", kind === "image" ? "public" : "product"); if (edit.id) fd.append("product_id", edit.id);
    try {
      const { data } = await api.post("/admin/upload", fd);
      if (kind === "image") setEdit({ ...edit, image_url: `${process.env.REACT_APP_BACKEND_URL}${data.url}` });
      else setEdit({ ...edit, file_id: data.id, file_name: file.name });
      toast.success("Uploaded");
    } catch (ex) { toast.error(errMsg(ex)); }
  };

  if (!rows) return <Spinner />;
  return (
    <div data-testid="admin-products">
      <AdminHeader title="Shop products" sub="Digital workbooks and downloads." right={<button onClick={() => setEdit(blank)} className="btn-gold !py-2.5" data-testid="new-product-btn"><Plus size={16} /> New product</button>} />
      <Table cols={["Product", "Price", "File", "Status", ""]} rows={rows} testId="products-table"
        render={(p) => (
          <tr key={p.id} data-testid={`product-row-${p.id}`}>
            <td className="px-4 py-3"><div className="flex items-center gap-3"><img src={p.image_url} alt="" className="w-12 h-12 object-cover rounded bg-stone-100" /><div><div className="font-medium">{p.title}</div><div className="text-xs text-slate-500 truncate max-w-md">{p.description}</div></div></div></td>
            <td className="px-4 py-3">{fmt(p.price)}</td>
            <td className="px-4 py-3 text-xs">{p.file_id ? <span className="text-emerald-700 flex items-center gap-1"><FileText size={12} /> Attached</span> : <span className="text-amber-700">Missing</span>}</td>
            <td className="px-4 py-3"><span className={`gold-badge ${p.active ? "!bg-emerald-50 !text-emerald-800 !border-emerald-200" : ""}`}>{p.active ? "Active" : "Hidden"}</span></td>
            <td className="px-4 py-3 text-right whitespace-nowrap"><button onClick={() => setEdit(p)} className="p-2 text-slate-400 hover:text-[#0A192F]" data-testid={`edit-product-${p.id}`}><Pencil size={15} /></button><button onClick={async () => { if (window.confirm("Delete product?")) { await api.delete(`/admin/products/${p.id}`); load(); } }} className="p-2 text-slate-400 hover:text-red-600" data-testid={`delete-product-${p.id}`}><Trash2 size={15} /></button></td>
          </tr>
        )} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit product" : "New product"}>
        {edit && (
          <form onSubmit={save} className="space-y-4">
            <div><label className="label-lux">Title</label><input required className="input-lux" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} data-testid="product-title-input" /></div>
            <div><label className="label-lux">Description</label><textarea rows={3} className="input-lux" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} data-testid="product-desc-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-lux">Price (cents)</label><input type="number" required className="input-lux" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} data-testid="product-price-input" /></div>
              <div><label className="label-lux">Visible</label><select className="input-lux" value={String(edit.active)} onChange={(e) => setEdit({ ...edit, active: e.target.value === "true" })}><option value="true">Active</option><option value="false">Hidden</option></select></div>
            </div>
            <div><label className="label-lux">Image URL</label><div className="flex gap-2"><input className="input-lux" value={edit.image_url} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} /><label className="btn-outline cursor-pointer !py-2 shrink-0"><Upload size={14} /><input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && upload(e.target.files[0], "image")} /></label></div></div>
            <div><label className="label-lux">Deliverable PDF</label><label className="btn-outline cursor-pointer w-full !py-2 !text-xs"><Upload size={14} /> {edit.file_id ? `Replace file${edit.file_name ? ` (${edit.file_name})` : ""}` : "Upload PDF"}<input type="file" accept=".pdf,.zip,application/pdf" hidden onChange={(e) => e.target.files[0] && upload(e.target.files[0], "file")} data-testid="product-file-upload" /></label></div>
            <button className="btn-gold w-full" data-testid="product-submit-btn">Save product</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
