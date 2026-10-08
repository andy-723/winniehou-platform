import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, fmtDate, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader, Table, Modal } from "./AdminLayout";

const hrs = (m) => `${(m / 60).toFixed(1)}h`;

export default function AdminClients() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [pkgs, setPkgs] = useState([]);
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState({ first_name: "", last_name: "", email: "", phone: "", status: "active", service_package_key: "" });
  const [eng, setEng] = useState({ service_package_key: "", start_date: "", notes: "" });

  const load = () => api.get("/admin/clients").then((r) => setRows(r.data));
  useEffect(() => { load(); api.get("/admin/services").then((r) => setPkgs(r.data)); }, []);

  const open = async (c) => { const { data } = await api.get(`/admin/clients/${c.id}`); setSel(data); };

  // auto-open a client when arriving via ?open=<id> (e.g. the timer bar "add package" link)
  useEffect(() => {
    const id = params.get("open");
    if (id && rows) { const c = rows.find((r) => r.id === id); if (c) open(c); setParams({}, { replace: true }); }
  }, [params, rows]); // eslint-disable-line

  const createClient = async () => {
    if (!nc.service_package_key) { toast.error("Choose a package"); return; }
    try { await api.post("/admin/clients", nc); toast.success("Client added"); setAdding(false); setNc({ first_name: "", last_name: "", email: "", phone: "", status: "active", service_package_key: "" }); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const addEng = async () => { try { await api.post(`/admin/clients/${sel.id}/engagements`, eng); toast.success("Engagement added"); setEng({ service_package_key: "", start_date: "", notes: "" }); open(sel); load(); } catch (e) { toast.error(errMsg(e)); } };
  const delClient = async () => { if (!window.confirm(`Delete ${sel.first_name} ${sel.last_name} and all their time entries?`)) return; try { await api.delete(`/admin/clients/${sel.id}`); toast.success("Client deleted"); setSel(null); load(); } catch (e) { toast.error(errMsg(e)); } };
  const startTimer = (e) => window.dispatchEvent(new CustomEvent("start-timer", { detail: { subject_type: "client", client_id: sel.id, engagement_id: e.id, billable: true, description: "", category: "" } }));

  if (!rows) return <Spinner />;

  return (
    <div data-testid="admin-clients">
      <AdminHeader title="Clients" sub="Coaching clients (people who bought a package)" right={<button onClick={() => setAdding(true)} className="btn-navy !py-2 !text-sm" data-testid="add-client-btn"><Plus size={15} /> New client</button>} />

      <Table cols={["Client", "Package(s)", "Hours used / incl.", "Status", ""]} rows={rows} testId="clients-table" render={(c) => {
        const incl = c.hours_included;
        const pct = incl ? Math.min(100, Math.round((c.hours_used / incl) * 100)) : 0;
        return (
          <tr key={c.id} onClick={() => open(c)} className="cursor-pointer hover:bg-stone-50" data-testid={`client-row-${c.id}`}>
            <td className="px-4 py-3"><div className="font-medium">{c.first_name} {c.last_name}</div><div className="text-xs text-slate-500">{c.email}</div></td>
            <td className="px-4 py-3 text-slate-600">{c.packages?.join(", ") || "—"}</td>
            <td className="px-4 py-3">
              {incl ? (
                <div className="w-32"><div className="flex justify-between text-xs mb-1"><span className={pct >= 100 ? "text-red-600 font-semibold" : pct >= 80 ? "text-amber-600" : "text-slate-600"}>{c.hours_used} / {incl} h</span></div>
                  <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div></div>
              ) : <span className="text-slate-600">{c.hours_used} h</span>}
            </td>
            <td className="px-4 py-3"><span className="gold-badge">{c.status}</span></td>
            <td className="px-4 py-3 text-right text-amber-700 text-sm">Open</td>
          </tr>
        );
      }} />

      <Modal open={adding} onClose={() => setAdding(false)} title="New client">
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <input className="input-lux" placeholder="First name" value={nc.first_name} onChange={(e) => setNc({ ...nc, first_name: e.target.value })} data-testid="client-first" />
            <input className="input-lux" placeholder="Last name" value={nc.last_name} onChange={(e) => setNc({ ...nc, last_name: e.target.value })} data-testid="client-last" />
          </div>
          <input className="input-lux" placeholder="Email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} data-testid="client-email" />
          <input className="input-lux" placeholder="Phone" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} data-testid="client-phone" />
          <select className="input-lux" value={nc.service_package_key} onChange={(e) => setNc({ ...nc, service_package_key: e.target.value })} data-testid="client-package">
            <option value="">Package (required)…</option>
            {pkgs.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
          </select>
          <button onClick={createClient} className="btn-gold w-full" data-testid="client-save">Add client</button>
        </div>
      </Modal>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.first_name} ${sel.last_name}` : ""} wide>
        {sel && (
          <div className="space-y-6 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-slate-500">{sel.email} · {sel.phone || "no phone"} · {hrs((sel.entries || []).reduce((s, e) => s + e.duration_minutes, 0))} logged</div>
              <button onClick={delClient} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline" data-testid="client-delete"><Trash2 size={13} /> Delete</button>
            </div>
            <div>
              <div className="eyebrow mb-2">Engagements</div>
              <ul className="divide-y border rounded-lg mb-3">
                {(sel.engagements || []).map((e) => <li key={e.id} className="px-3 py-2 flex justify-between items-center"><span>{pkgs.find((p) => p.key === e.service_package_key)?.name || e.service_package_key}</span><div className="flex items-center gap-3"><span className="gold-badge">{e.status}</span><button onClick={() => startTimer(e)} className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline" data-testid={`client-start-timer-${e.id}`}><Play size={12} /> Start timer</button></div></li>)}
                {(sel.engagements || []).length === 0 && <li className="px-3 py-3 text-slate-400">No engagements</li>}
              </ul>
              <div className="flex gap-2">
                <select className="input-lux" value={eng.service_package_key} onChange={(e) => setEng({ ...eng, service_package_key: e.target.value })} data-testid="eng-package"><option value="">Add package…</option>{pkgs.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
                <button disabled={!eng.service_package_key} onClick={addEng} className="btn-navy !py-2 !text-xs shrink-0 disabled:opacity-50" data-testid="eng-add">Add</button>
              </div>
            </div>
            <div>
              <div className="eyebrow mb-2">Time entries</div>
              <ul className="divide-y border rounded-lg">
                {(sel.entries || []).slice(0, 15).map((e) => <li key={e.id} className="px-3 py-2 flex justify-between"><span className="truncate">{e.description || e.category}</span><span className="font-mono text-slate-600">{hrs(e.duration_minutes)}</span></li>)}
                {(sel.entries || []).length === 0 && <li className="px-3 py-3 text-slate-400">No time logged — use the timer bar (Client) above.</li>}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
