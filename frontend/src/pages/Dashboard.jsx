import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PlayCircle, Receipt, FileDown, MonitorSmartphone, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, fmtDate, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Spinner, Empty, PageHeader } from "@/components/Shared";

const tabs = [["courses", "My courses", PlayCircle], ["library", "Downloads", FileDown], ["orders", "Orders", Receipt], ["devices", "Devices", MonitorSmartphone]];

export default function Dashboard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "courses";
  const [data, setData] = useState({});

  useEffect(() => {
    const ep = { courses: "/me/courses", library: "/me/products", orders: "/me/orders", devices: "/auth/sessions" }[tab];
    setData((d) => ({ ...d, [tab]: undefined }));
    api.get(ep).then((r) => setData((d) => ({ ...d, [tab]: r.data }))).catch(() => setData((d) => ({ ...d, [tab]: [] })));
  }, [tab]);

  const rows = data[tab];

  const revoke = async (sid) => {
    await api.delete(`/auth/sessions/${sid}`);
    toast.success("Device signed out");
    setData((d) => ({ ...d, devices: d.devices.filter((s) => s.id !== sid) }));
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-16" data-testid="dashboard-page">
      <PageHeader tone="light" eyebrow={`Welcome back, ${user?.name?.split(" ")[0]}`} title="My learning" />
      <div className="flex flex-wrap gap-x-1 border-b border-slate-200 mb-10">
        {tabs.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setParams({ tab: k })} data-testid={`dash-tab-${k}`}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === k ? "border-amber-500 text-[#0A192F] font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Icon size={15} /> {label}</button>
        ))}
      </div>

      {rows === undefined ? <Spinner /> : tab === "courses" ? (
        rows.length === 0 ? <Empty tone="light" title="No courses yet" hint="Your enrolled courses will appear here." cta={<Link to="/courses" className="btn-gold">Browse catalog</Link>} /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="my-courses-grid">
            {rows.map(({ course, progress }) => (
              <div key={course.id} className="card-lux flex flex-col" data-testid={`my-course-${course.slug}`}>
                <img src={course.thumbnail_url} alt="" className="aspect-[16/9] object-cover" />
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-serif text-xl text-[#0A192F]">{course.title}</h3>
                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden"><span className="block h-full bg-amber-500 rounded-full transition-[width] duration-700" style={{ width: `${progress.percent}%` }} /></span>
                    <span data-testid={`progress-${course.slug}`}>{progress.percent}%</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{progress.completed} of {progress.total} lessons complete</div>
                  <Link to={`/learn/${course.slug}${progress.last_lesson_id ? `?lesson=${progress.last_lesson_id}` : ""}`} className="btn-navy mt-6 !py-2.5 !text-sm" data-testid={`resume-${course.slug}`}>
                    <PlayCircle size={15} /> {progress.percent === 0 ? "Start course" : progress.percent === 100 ? "Review course" : "Resume"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "library" ? (
        rows.length === 0 ? <Empty tone="light" title="No downloads yet" hint="Workbooks you purchase appear here." cta={<Link to="/shop" className="btn-gold">Visit the shop</Link>} /> : (
          <div className="grid md:grid-cols-2 gap-5">
            {rows.map((p) => (
              <div key={p.id} className="card-lux p-5 flex flex-col sm:flex-row gap-4 sm:items-center" data-testid={`library-item-${p.id}`}>
                <img src={p.image_url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                <div className="flex-1"><div className="font-serif text-lg text-[#0A192F]">{p.title}</div><div className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</div></div>
                {p.file_id ? <a href={fileUrl(p.file_id, true)} className="btn-gold !py-2 !px-3 !text-xs" data-testid={`download-${p.id}`}><FileDown size={14} /> Download</a>
                           : <span className="text-xs text-slate-400 italic">File coming soon</span>}
              </div>
            ))}
          </div>
        )
      ) : tab === "orders" ? (
        rows.length === 0 ? <Empty tone="light" title="No orders yet" /> : (
          <div className="card-lux overflow-x-auto">
            <table className="w-full text-sm" data-testid="orders-table">
              <thead className="bg-stone-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="text-left px-5 py-3">Order</th><th className="text-left px-5 py-3">Date</th><th className="text-left px-5 py-3">Items</th><th className="text-right px-5 py-3">Total</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((o) => (
                  <tr key={o.id} data-testid={`order-row-${o.id}`}>
                    <td className="px-5 py-3 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(o.created_at)}</td>
                    <td className="px-5 py-3">{o.items.map((i) => i.title).join(", ")}</td>
                    <td className="px-5 py-3 text-right font-medium">{fmt(o.total)}</td>
                    <td className="px-5 py-3 text-center"><span className={`gold-badge ${o.status === "refunded" ? "!bg-red-50 !text-red-700 !border-red-200" : ""}`}>{o.status}</span></td>
                    <td className="px-5 py-3 text-right"><Link to={`/orders/${o.id}`} className="text-amber-700 text-xs font-medium hover:underline" data-testid={`receipt-link-${o.id}`}>Receipt</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="max-w-2xl space-y-3" data-testid="devices-list">
          <p className="text-sm text-slate-500 mb-5">Your account can be active on <strong>2 devices</strong> at a time. Signing in on a third device signs out the oldest session.</p>
          {rows.map((s) => (
            <div key={s.id} className="card-lux p-4 flex items-center gap-4" data-testid={`session-${s.id}`}>
              <MonitorSmartphone size={20} className="text-slate-400" />
              <div className="flex-1 min-w-0"><div className="text-sm truncate">{s.user_agent || "Unknown device"}</div><div className="text-xs text-slate-400">Last active {fmtDate(s.last_seen)} {s.current && <span className="gold-badge ml-2 !py-0">This device</span>}</div></div>
              {!s.current && <button onClick={() => revoke(s.id)} className="p-2 text-slate-400 hover:text-red-600" data-testid={`revoke-${s.id}`}><Trash2 size={16} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderReceipt() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  useEffect(() => { api.get(`/me/orders/${id}`).then((r) => setOrder(r.data)).catch(() => setOrder(false)); }, [id]);
  if (order === null) return <Spinner />;
  if (order === false) return <div className="text-center py-32 font-serif text-2xl">Order not found.</div>;
  return (
    <div className="max-w-2xl mx-auto px-6 py-16" data-testid="receipt-page">
      <div className="flex justify-between items-start mb-8 print:hidden">
        <Link to="/dashboard?tab=orders" className="text-sm text-slate-500 hover:text-slate-800">← Orders</Link>
        <div className="flex gap-2">
          {order.receipt_url && <a href={order.receipt_url} target="_blank" rel="noreferrer" className="btn-outline !py-2 !text-xs" data-testid="stripe-receipt-link">Stripe receipt</a>}
          <button onClick={() => window.print()} className="btn-navy !py-2 !text-xs" data-testid="print-receipt-btn"><Printer size={14} /> Print / Save PDF</button>
        </div>
      </div>
      <div className="card-lux p-10">
        <div className="flex justify-between items-start border-b border-slate-200 pb-6">
          <div><div className="font-serif text-lg tracking-[0.25em] text-[#0A192F]">WINNIE HOU</div><div className="text-xs text-slate-500 mt-1">Business English Mastery</div></div>
          <div className="text-right"><div className="eyebrow">Receipt</div><div className="font-mono text-sm mt-1">#{order.id.slice(0, 8).toUpperCase()}</div><div className="text-xs text-slate-500">{fmtDate(order.paid_at || order.created_at)}</div></div>
        </div>
        <div className="text-sm text-slate-600 mt-6">Billed to<br /><strong className="text-slate-800">{order.name}</strong><br />{order.email}</div>
        <table className="w-full text-sm mt-8">
          <thead><tr className="text-xs uppercase tracking-wider text-slate-400 border-b"><th className="text-left py-2">Item</th><th className="text-right py-2">Amount</th></tr></thead>
          <tbody>{order.items.map((i) => <tr key={i.id} className="border-b border-slate-100"><td className="py-3">{i.title}<span className="text-xs text-slate-400 ml-2 uppercase">{i.type}</span></td><td className="py-3 text-right">{fmt(i.unit_amount)}</td></tr>)}</tbody>
        </table>
        <div className="mt-6 space-y-1 text-sm text-right">
          <div className="text-slate-500">Subtotal {fmt(order.subtotal)}</div>
          {order.discount > 0 && <div className="text-emerald-700">Discount ({order.coupon_code}) − {fmt(order.discount)}</div>}
          <div className="font-serif text-3xl text-[#0A192F] pt-2" data-testid="receipt-total">{fmt(order.total)}</div>
          <div className="text-xs"><span className="gold-badge">{order.status}</span></div>
        </div>
      </div>
    </div>
  );
}
