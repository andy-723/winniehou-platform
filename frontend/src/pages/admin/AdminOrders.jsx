import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, fmtDate, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader, Table } from "./AdminLayout";

export default function AdminOrders() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("");
  const load = () => api.get("/admin/orders", { params: status ? { status } : {} }).then((r) => setRows(r.data));
  useEffect(() => { load(); }, [status]); // eslint-disable-line

  const refund = async (o) => {
    if (!window.confirm(`Refund ${fmt(o.total)} to ${o.email} and revoke access?`)) return;
    try { await api.post(`/admin/orders/${o.id}/refund`); toast.success("Refund issued"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  if (!rows) return <Spinner />;
  return (
    <div data-testid="admin-orders">
      <AdminHeader title="Orders & refunds" sub="Every paid order. Refunds go back to the original card via Stripe." right={
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-lux w-44" data-testid="order-status-filter"><option value="">All</option><option value="paid">Paid</option><option value="refunded">Refunded</option><option value="failed">Failed</option></select>} />
      <Table cols={["Order", "Customer", "Items", "Coupon", "Total", "Status", "Date", ""]} rows={rows} testId="orders-table"
        render={(o) => (
          <tr key={o.id} data-testid={`admin-order-${o.id}`}>
            <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
            <td className="px-4 py-3"><div>{o.name}</div><div className="text-xs text-slate-500">{o.email}</div></td>
            <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{o.items.map((i) => i.title).join(", ")}</td>
            <td className="px-4 py-3 font-mono text-xs">{o.coupon_code || "—"}</td>
            <td className="px-4 py-3 font-medium">{fmt(o.total)}</td>
            <td className="px-4 py-3"><span className={`gold-badge ${o.status === "refunded" ? "!bg-red-50 !text-red-700 !border-red-200" : ""}`}>{o.status}</span></td>
            <td className="px-4 py-3 text-slate-500">{fmtDate(o.created_at)}</td>
            <td className="px-4 py-3 text-right">{o.status === "paid" && <button onClick={() => refund(o)} className="btn-outline !py-1.5 !px-3 !text-xs" data-testid={`refund-${o.id}`}><RotateCcw size={13} /> Refund</button>}</td>
          </tr>
        )} />
    </div>
  );
}
