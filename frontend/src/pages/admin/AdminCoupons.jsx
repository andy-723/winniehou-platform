import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, fmtDate, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader, Table, Modal } from "./AdminLayout";

const blank = { code: "", kind: "percent", value: 10, max_uses: "", expires_at: "" };

export default function AdminCoupons() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const load = () => api.get("/admin/coupons").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/coupons", { ...f, value: Number(f.value), max_uses: f.max_uses ? Number(f.max_uses) : null, expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null });
      toast.success("Coupon created"); setOpen(false); setF(blank); load();
    } catch (ex) { toast.error(errMsg(ex)); }
  };

  if (!rows) return <Spinner />;
  return (
    <div data-testid="admin-coupons">
      <AdminHeader title="Coupons" sub="Discount codes students enter at checkout." right={<button onClick={() => setOpen(true)} className="btn-gold !py-2.5" data-testid="new-coupon-btn"><Plus size={16} /> New coupon</button>} />
      <Table cols={["Code", "Discount", "Uses", "Expires", "Active", ""]} rows={rows} testId="coupons-table"
        render={(c) => (
          <tr key={c.id} data-testid={`coupon-row-${c.code}`}>
            <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
            <td className="px-4 py-3">{c.kind === "percent" ? `${c.value}% off` : `${fmt(c.value)} off`}</td>
            <td className="px-4 py-3 text-slate-500">{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
            <td className="px-4 py-3 text-slate-500">{c.expires_at ? fmtDate(c.expires_at) : "Never"}</td>
            <td className="px-4 py-3"><label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={c.active} onChange={async (e) => { await api.patch(`/admin/coupons/${c.id}?active=${e.target.checked}`); load(); }} className="accent-amber-500" data-testid={`coupon-toggle-${c.code}`} /><span className="text-xs">{c.active ? "On" : "Off"}</span></label></td>
            <td className="px-4 py-3 text-right"><button onClick={async () => { if (window.confirm("Delete coupon?")) { await api.delete(`/admin/coupons/${c.id}`); load(); } }} className="p-2 text-slate-400 hover:text-red-600" data-testid={`coupon-delete-${c.code}`}><Trash2 size={15} /></button></td>
          </tr>
        )} />
      <Modal open={open} onClose={() => setOpen(false)} title="New coupon">
        <form onSubmit={create} className="space-y-4">
          <div><label className="label-lux">Code</label><input required className="input-lux font-mono uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} data-testid="coupon-code-input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-lux">Type</label><select className="input-lux" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} data-testid="coupon-kind-select"><option value="percent">Percent off</option><option value="fixed">Fixed amount (cents)</option></select></div>
            <div><label className="label-lux">Value</label><input type="number" required min={1} className="input-lux" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} data-testid="coupon-value-input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-lux">Max uses (blank = unlimited)</label><input type="number" className="input-lux" value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value })} /></div>
            <div><label className="label-lux">Expires</label><input type="date" className="input-lux" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} /></div>
          </div>
          <button className="btn-gold w-full" data-testid="coupon-submit-btn">Create coupon</button>
        </form>
      </Modal>
    </div>
  );
}
