import { useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Upload, Check, Loader2, Video, Phone } from "lucide-react";
import { api, errMsg } from "@/lib/api";

function IntakeForm({ mode }) {
  const [sp] = useSearchParams();
  const src = sp.get("src") || "wechat";
  const pkg = sp.get("pkg") || "";
  const fileRef = useRef(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", mobile: "", email: "", wechat_id: "", call_mode: "meet", send_resume_later: false, consent: false });
  const [resume, setResume] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState("");

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setErr("Resume must be under 10MB"); return; }
    setUploading(true); setErr("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/intake/resume", fd);
      setResume(data);
    } catch (ex) { setErr(errMsg(ex)); } finally { setUploading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.consent) { setErr("Please tick the consent box to continue."); return; }
    if (!resume && !form.send_resume_later) { setErr("Please upload your resume or tick 'I'll send it on WeChat'."); return; }
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/intake/submit", {
        ...form, resume_file_id: resume?.file_id || null, source: src, pkg,
        call_type: mode === "book" ? "booked" : "adhoc",
      });
      setDone(data);
    } catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="max-w-lg mx-auto text-center py-16" data-testid="intake-success">
        <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-6"><Check className="text-amber-400" size={26} /></div>
        <h1 className="font-serif text-3xl text-[#F9F8F3]">Thank you, {form.first_name}!</h1>
        <p className="text-slate-300 mt-4">{done.message}</p>
        {mode === "book" && !done.calendar_connected && (
          <p className="text-xs text-slate-500 mt-6">Online booking opens soon. For now Winnie will message you on WeChat to lock in a time.</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-12" data-testid={`${mode}-page`}>
      <div className="eyebrow-dark mb-3">Better Careers</div>
      <h1 className="font-serif text-3xl sm:text-4xl text-[#F9F8F3]">{mode === "book" ? "Book your consultation" : "Request a call"}</h1>
      <p className="text-slate-400 mt-3 text-sm">Share a few details and your resume so Winnie can prepare for your session.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input className="input-dark" placeholder="First name" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="intake-first" />
          <input className="input-dark" placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="intake-last" />
        </div>
        <input className="input-dark" placeholder="Mobile" required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} data-testid="intake-mobile" />
        <input className="input-dark" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="intake-email" />
        <input className="input-dark" placeholder="WeChat ID (optional)" value={form.wechat_id} onChange={(e) => setForm({ ...form, wechat_id: e.target.value })} data-testid="intake-wechat" />

        <div>
          <div className="text-sm text-slate-300 mb-2">Your resume (PDF or Word, max 10MB)</div>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={upload} className="hidden" data-testid="intake-resume-input" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || form.send_resume_later} className="w-full card-dark px-4 py-3 flex items-center gap-2 text-sm text-slate-300 hover:border-amber-500/50 disabled:opacity-50" data-testid="intake-resume-btn">
            {uploading ? <Loader2 className="animate-spin" size={16} /> : resume ? <Check className="text-amber-400" size={16} /> : <Upload size={16} />}
            {resume ? resume.filename : uploading ? "Uploading…" : "Upload resume"}
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-400 mt-2"><input type="checkbox" checked={form.send_resume_later} onChange={(e) => setForm({ ...form, send_resume_later: e.target.checked })} data-testid="intake-later" /> I'll send my resume on WeChat instead</label>
        </div>

        {mode === "book" && (
          <div>
            <div className="text-sm text-slate-300 mb-2">How would you like to talk?</div>
            <div className="grid grid-cols-1 gap-2">
              {[["meet", <Video size={15} key="v" />, "Video call (Google Meet) — we'll look at your resume together on screen"],
                ["phone", <Phone size={15} key="p" />, "Phone or WeChat call, I'll open a link to follow along"]].map(([val, icon, label]) => (
                <button type="button" key={val} onClick={() => setForm({ ...form, call_mode: val })} className={`card-dark px-4 py-3 flex items-center gap-2 text-left text-sm ${form.call_mode === val ? "!border-amber-400/70 text-amber-200" : "text-slate-300"}`} data-testid={`intake-mode-${val}`}>{icon} {label}</button>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1" data-testid="intake-consent" /> I agree to Better Careers storing my details and resume to prepare for my consultation. See our <a href="/privacy" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">Privacy Policy</a>.</label>

        {err && <div className="text-sm text-red-400" data-testid="intake-error">{err}</div>}
        <button disabled={busy} className="btn-gold w-full disabled:opacity-60" data-testid="intake-submit">{busy ? "Sending…" : mode === "book" ? "Continue" : "Request a call"}</button>
      </form>
    </div>
  );
}

export default function Book() { return <div className="bg-[#0A192F] min-h-screen px-6"><IntakeForm mode="book" /></div>; }
export function Intake() { return <div className="bg-[#0A192F] min-h-screen px-6"><IntakeForm mode="intake" /></div>; }
