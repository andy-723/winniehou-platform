import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Square, Search } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";

const fmtElapsed = (startIso) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

export default function TimerBar() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(null);
  const [cats, setCats] = useState([]);
  const [subject, setSubject] = useState("client");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("");
  const [billable, setBillable] = useState(true);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null); // {id, label, engagement_id?}
  const [, force] = useState(0);
  const tick = useRef(null);

  const loadTimer = () => api.get("/admin/time/timer").then((r) => setRunning(r.data)).catch(() => {});
  useEffect(() => { loadTimer(); api.get("/admin/time/categories").then((r) => setCats(r.data)); }, []);
  useEffect(() => { tick.current = setInterval(() => force((x) => x + 1), 1000); return () => clearInterval(tick.current); }, []);

  // External "Start timer" shortcuts (student drawer, client engagements, Continue button)
  useEffect(() => {
    const h = async (e) => {
      try { const { data } = await api.post("/admin/time/timer/start", e.detail); setRunning(data); toast.success("Timer started"); window.dispatchEvent(new Event("time-updated")); }
      catch (err) { toast.error(errMsg(err)); }
    };
    window.addEventListener("start-timer", h);
    return () => window.removeEventListener("start-timer", h);
  }, []);

  useEffect(() => {
    if (!q || subject === "internal") { setResults([]); return; }
    const t = setTimeout(async () => {
      if (subject === "student") { const { data } = await api.get("/admin/students", { params: { q } }); setResults(data.map((u) => ({ id: u.id, label: `${u.name} · ${u.email}` }))); }
      else { const { data } = await api.get("/admin/clients"); setResults(data.filter((c) => `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(q.toLowerCase())).map((c) => ({ id: c.id, label: `${c.first_name} ${c.last_name}`, engagement_id: c.engagements?.find((e) => e.status === "active")?.id || c.engagements?.[0]?.id }))); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, subject]);

  const catOptions = cats.filter((c) => c.subject_type === subject);

  const start = async () => {
    if (subject !== "internal" && !picked) { toast.error("Pick a " + subject); return; }
    const body = { subject_type: subject, description: desc, category: cat, billable };
    if (subject === "student") body.student_id = picked.id;
    if (subject === "client") { body.client_id = picked.id; body.engagement_id = picked.engagement_id; if (!body.engagement_id) { toast.error("This client has no engagement yet"); return; } }
    try { const { data } = await api.post("/admin/time/timer/start", body); setRunning(data); setDesc(""); setQ(""); setPicked(null); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const stop = async () => { try { await api.post("/admin/time/timer/stop"); setRunning(null); toast.success("Time saved"); window.dispatchEvent(new Event("time-updated")); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <div className="sticky top-0 z-30 bg-[#0A192F] text-white border-b border-amber-500/20 px-6 py-2.5 flex items-center gap-3 flex-wrap" data-testid="timer-bar">
      {running ? (
        <>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-slate-200 truncate max-w-xs">{running.description || running.category || "Timing…"}</span>
          <span className="font-mono text-amber-300 ml-auto" data-testid="timer-elapsed">{fmtElapsed(running.started_at)}</span>
          <button onClick={stop} className="inline-flex items-center gap-1.5 bg-red-500/90 hover:bg-red-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg" data-testid="timer-stop"><Square size={13} /> Stop</button>
        </>
      ) : (
        <>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What are you working on?" className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-500 flex-1 min-w-[160px]" data-testid="timer-desc" />
          <div className="flex rounded-lg overflow-hidden border border-white/15">
            {["client", "student", "internal"].map((s) => (
              <button key={s} onClick={() => { setSubject(s); setPicked(null); setQ(""); setCat(""); }} data-testid={`timer-subject-${s}`}
                className={`px-2.5 py-1.5 text-xs capitalize ${subject === s ? "bg-amber-500 text-[#0A192F]" : "text-slate-300 hover:bg-white/5"}`}>{s}</button>
            ))}
          </div>
          {subject !== "internal" && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={picked ? picked.label : q} onChange={(e) => { setPicked(null); setQ(e.target.value); }} placeholder={`Find ${subject}`} className="bg-white/5 border border-white/15 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-slate-500 w-48" data-testid="timer-subject-search" />
              {results.length > 0 && !picked && (
                <div className="absolute z-40 mt-1 w-64 bg-[#0F213D] border border-white/15 rounded-lg max-h-56 overflow-auto">
                  {results.map((r) => <button key={r.id} onClick={() => { setPicked(r); setResults([]); }} className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5" data-testid={`timer-pick-${r.id}`}>{r.label}</button>)}
                </div>
              )}
            </div>
          )}
          {subject === "client" && picked && !picked.engagement_id && (
            <button onClick={() => navigate(`/admin/clients?open=${picked.id}`)} className="text-xs text-amber-300 underline" data-testid="timer-add-package">No package — add one</button>
          )}
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="bg-white/5 border border-white/15 rounded-lg px-2 py-1.5 text-sm text-white" data-testid="timer-category">
            <option value="">Category</option>
            {catOptions.map((c) => <option key={c.id} value={c.name} className="text-black">{c.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} data-testid="timer-billable" /> Billable</label>
          <button onClick={start} className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-[#0A192F] text-sm font-semibold px-3 py-1.5 rounded-lg ml-auto" data-testid="timer-start"><Play size={13} /> Start</button>
        </>
      )}
    </div>
  );
}
