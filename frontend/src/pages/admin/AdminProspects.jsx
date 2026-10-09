import { useEffect, useState, useRef } from "react";
import { Plus, Upload, Loader2, Copy, Play, Phone, Video, Clock } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmtDate } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { AdminHeader, Modal } from "./AdminLayout";

const LABELS = { new: "New", call_booked: "Call booked", call_done: "Call done", cdp_draft: "CDP draft", cdp_review: "CDP review", plan_sent: "Plan sent", plan_viewed: "Plan viewed", accepted: "Accepted", paid: "Paid", lost: "Lost" };
const SOURCES = ["xiaohongshu", "wechat", "referral", "website", "other"];
const hrs = (m) => `${(m / 60).toFixed(1)}h`;

export default function AdminProspects() {
  const [data, setData] = useState(null);
  const [view, setView] = useState("board");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState(null);
  const [lostId, setLostId] = useState(null);
  const [lostReason, setLostReason] = useState("");

  const load = () => api.get("/admin/prospects", { params: { q, source } }).then((r) => setData(r.data));
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, source]); // eslint-disable-line
  useEffect(() => { const h = () => sel && open(sel.id); window.addEventListener("time-updated", h); return () => window.removeEventListener("time-updated", h); }); // eslint-disable-line

  const open = async (id) => { const { data } = await api.get(`/admin/prospects/${id}`); setSel(data); setEdit({ ...data }); };
  const move = async (id, status) => { try { await api.post(`/admin/prospects/${id}/status`, { status }); load(); if (sel?.id === id) open(id); } catch (e) { toast.error(errMsg(e)); } };
  const saveEdit = async () => { try { const { data } = await api.put(`/admin/prospects/${sel.id}`, edit); setSel(data); toast.success("Saved"); load(); } catch (e) { toast.error(errMsg(e)); } };
  const startCall = (p) => window.dispatchEvent(new CustomEvent("start-timer", { detail: { subject_type: "prospect", prospect_id: p.id, category: "Discovery call", billable: false, description: `Call with ${p.first_name}` } }));
  const copyLink = (kind, p) => { const url = `${window.location.origin}/${kind}?src=${p?.source || "wechat"}`; navigator.clipboard.writeText(url); toast.success(`${kind === "book" ? "Booking" : "Intake"} link copied`); };
  const doLost = async () => { try { await api.post(`/admin/prospects/${lostId}/lost`, { reason: lostReason }); setLostId(null); setLostReason(""); setSel(null); load(); } catch (e) { toast.error(errMsg(e)); } };

  if (!data) return <Spinner />;
  const cols = [...data.flow, "lost"];
  const grouped = Object.fromEntries(cols.map((c) => [c, data.prospects.filter((p) => p.status === c)]));

  return (
    <div data-testid="admin-prospects">
      <AdminHeader title="Prospects" sub="Lead-to-client pipeline" right={
        <div className="flex gap-2">
          <button onClick={() => setAdding(true)} className="btn-navy !py-2 !text-sm" data-testid="new-prospect-btn"><Plus size={15} /> New prospect</button>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button onClick={() => setView("board")} className={`px-3 py-2 text-sm ${view === "board" ? "bg-[#0A192F] text-amber-300" : "text-slate-600"}`} data-testid="view-board">Board</button>
            <button onClick={() => setView("list")} className={`px-3 py-2 text-sm ${view === "list" ? "bg-[#0A192F] text-amber-300" : "text-slate-600"}`} data-testid="view-list">List</button>
          </div>
        </div>} />

      <div className="flex gap-3 mb-5 flex-wrap">
        <input className="input-lux !py-2 max-w-xs" placeholder="Search name, email, mobile…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="prospect-search" />
        <select className="input-lux !py-2 max-w-[180px]" value={source} onChange={(e) => setSource(e.target.value)} data-testid="prospect-source-filter"><option value="">All sources</option>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>

      {view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4" data-testid="prospect-board">
          {cols.map((c) => (
            <div key={c} className="shrink-0 w-64" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData("id"); if (id) move(id, c); }} data-testid={`board-col-${c}`}>
              <div className="flex items-center justify-between mb-2 px-1"><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{LABELS[c]}</span><span className="text-xs text-slate-400">{data.counts[c] || 0}</span></div>
              <div className="space-y-2 min-h-[40px]">
                {grouped[c].map((p) => (
                  <div key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", p.id)} onClick={() => open(p.id)} className="card-lux p-3 cursor-pointer hover:border-amber-400/60" data-testid={`prospect-card-${p.id}`}>
                    <div className="text-sm font-medium text-[#0A192F]">{p.first_name} {p.last_name}</div>
                    <div className="text-xs text-slate-500 truncate">{p.email || p.mobile || "—"}</div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400"><span className="uppercase">{p.source}</span>{p.call_mode === "meet" ? <Video size={11} /> : <Phone size={11} />}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-lux overflow-x-auto" data-testid="prospect-list">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-slate-500"><tr>{["Name", "Contact", "Source", "Status", "Created"].map((c) => <th key={c} className="text-left px-4 py-3">{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.prospects.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No prospects yet.</td></tr> :
                data.prospects.map((p) => (
                  <tr key={p.id} onClick={() => open(p.id)} className="cursor-pointer hover:bg-stone-50" data-testid={`prospect-row-${p.id}`}>
                    <td className="px-4 py-3 text-[#0A192F]">{p.first_name} {p.last_name}</td>
                    <td className="px-4 py-3 text-slate-500">{p.email || p.mobile}</td>
                    <td className="px-4 py-3 text-slate-500">{p.source}</td>
                    <td className="px-4 py-3"><span className="gold-badge">{LABELS[p.status]}</span></td>
                    <td className="px-4 py-3 text-slate-400">{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <NewProspect open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.first_name} ${sel.last_name}` : ""} wide>
        {sel && edit && (
          <div className="space-y-5 text-sm" data-testid="prospect-detail">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => startCall(sel)} className="btn-gold !py-1.5 !text-xs" data-testid="prospect-start-call"><Play size={13} /> Start call</button>
              <button onClick={() => copyLink("book", sel)} className="btn-outline !py-1.5 !text-xs" data-testid="prospect-copy-book"><Copy size={13} /> Copy booking link</button>
              <button onClick={() => copyLink("intake", sel)} className="btn-outline !py-1.5 !text-xs" data-testid="prospect-copy-intake"><Copy size={13} /> Copy intake link</button>
              <span className="ml-auto inline-flex items-center gap-1 text-slate-500 text-xs"><Clock size={13} /> {hrs(sel.minutes || 0)} logged</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input className="input-lux" value={edit.first_name} onChange={(e) => setEdit({ ...edit, first_name: e.target.value })} placeholder="First name" data-testid="edit-first" />
              <input className="input-lux" value={edit.last_name} onChange={(e) => setEdit({ ...edit, last_name: e.target.value })} placeholder="Last name" />
              <input className="input-lux" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="Email" />
              <input className="input-lux" value={edit.mobile} onChange={(e) => setEdit({ ...edit, mobile: e.target.value })} placeholder="Mobile" />
              <input className="input-lux" value={edit.wechat_id} onChange={(e) => setEdit({ ...edit, wechat_id: e.target.value })} placeholder="WeChat ID" />
              <select className="input-lux" value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })}>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <select className="input-lux" value={edit.status} onChange={(e) => move(sel.id, e.target.value)} data-testid="prospect-status-select">{[...data.flow, "lost"].map((s) => <option key={s} value={s}>{LABELS[s]}</option>)}</select>
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} className="btn-navy !py-1.5 !text-xs" data-testid="prospect-save">Save details</button>
              {sel.resume_file && <a href={`/api/files/${sel.resume_file.id}?download=1&auth=${localStorage.getItem("access_token")}`} target="_blank" rel="noreferrer" className="btn-outline !py-1.5 !text-xs">Resume: {sel.resume_file.original_filename}</a>}
              <button onClick={() => setLostId(sel.id)} className="text-xs text-red-600 hover:underline ml-auto" data-testid="prospect-mark-lost">Mark lost</button>
            </div>

            {sel.suggestions && (
              <div className="card-lux p-4" data-testid="prospect-suggestions">
                <div className="eyebrow mb-2">Claude read the resume</div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>Most recent: {sel.suggestions.most_recent_role || "—"} · {sel.suggestions.years_experience ?? "—"} yrs</div>
                  <div>{sel.suggestions.experience_summary || ""}</div>
                  {(sel.suggestions.education || []).length > 0 && <div>Education: {sel.suggestions.education.join("; ")}</div>}
                </div>
              </div>
            )}

            <div>
              <div className="eyebrow mb-2">Activity</div>
              <ul className="space-y-1 max-h-48 overflow-auto text-xs text-slate-500">
                {(sel.activity || []).map((a) => <li key={a.id} className="flex justify-between gap-3"><span>{a.action}</span><span className="text-slate-400">{fmtDate(a.at)}</span></li>)}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!lostId} onClose={() => setLostId(null)} title="Mark prospect as lost">
        <div className="space-y-3">
          <textarea className="input-lux" rows={3} placeholder="Reason (optional)" value={lostReason} onChange={(e) => setLostReason(e.target.value)} data-testid="lost-reason" />
          <button onClick={doLost} className="btn-gold w-full" data-testid="lost-confirm">Mark lost</button>
        </div>
      </Modal>
    </div>
  );
}

function NewProspect({ open, onClose, onDone }) {
  const fileRef = useRef(null);
  const [resume, setResume] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sug, setSug] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", mobile: "", wechat_id: "", source: "wechat", consent: false });
  const [busy, setBusy] = useState(false);

  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/intake/resume", fd);
      setResume(data);
      setParsing(true);
      // create a throwaway parse via a temp prospect is heavy; instead reuse submit path on save
    } catch (ex) { toast.error(errMsg(ex)); } finally { setUploading(false); setParsing(false); }
  };

  const save = async () => {
    if (!f.first_name) { toast.error("Name required"); return; }
    if (!f.consent) { toast.error("Tick consent given verbally on WeChat"); return; }
    setBusy(true);
    try {
      await api.post("/admin/prospects", { ...f, resume_file_id: resume?.file_id || null });
      toast.success("Prospect created"); reset(); onDone();
    } catch (ex) { toast.error(errMsg(ex)); } finally { setBusy(false); }
  };
  const reset = () => { setResume(null); setSug(null); setF({ first_name: "", last_name: "", email: "", mobile: "", wechat_id: "", source: "wechat", consent: false }); };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="New prospect">
      <div className="space-y-3 text-sm" data-testid="new-prospect-form">
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={upload} className="hidden" />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full card-lux px-4 py-3 flex items-center gap-2 text-slate-600 hover:border-amber-400/60" data-testid="np-upload">
          {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}{resume ? resume.filename : "Upload resume (Claude will read it)"}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <input className="input-lux" placeholder="First name" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} data-testid="np-first" />
          <input className="input-lux" placeholder="Last name" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
          <input className="input-lux" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="np-email" />
          <input className="input-lux" placeholder="Mobile" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} data-testid="np-mobile" />
          <input className="input-lux" placeholder="WeChat ID" value={f.wechat_id} onChange={(e) => setF({ ...f, wechat_id: e.target.value })} />
          <select className="input-lux" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </div>
        <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-0.5" data-testid="np-consent" /> Consent given verbally on WeChat</label>
        <button onClick={save} disabled={busy} className="btn-gold w-full disabled:opacity-60" data-testid="np-save">{busy ? "Creating…" : "Create prospect"}</button>
      </div>
    </Modal>
  );
}
