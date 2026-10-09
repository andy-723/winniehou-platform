import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { Modal } from "./AdminLayout";

const LIST_KEYS = ["current_situation", "current_challenges", "goals", "development_focus", "support_approach", "short_term_milestones"];
const TEXT_KEYS = ["background", "career_recommendation"];

export default function CDPModal({ prospect, packages, open, onClose, onChanged }) {
  const [notes, setNotes] = useState({ pronoun: "", education: "", experience_summary: "", visa_status: "", salary_expectation: "", challenges: "", goals: "", winnie_notes: "", target_roles: [], packages: {} });
  const [sections, setSections] = useState(null);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(null);

  useEffect(() => {
    if (!prospect) return;
    const n = prospect.cdp_notes || {};
    const sug = prospect.suggestions || {};
    setNotes({
      pronoun: n.pronoun || prospect.pronoun || "", education: n.education || (sug.education || []).join("; "),
      experience_summary: n.experience_summary || sug.experience_summary || "", visa_status: n.visa_status || "",
      salary_expectation: n.salary_expectation || "", challenges: n.challenges || "", goals: n.goals || "",
      winnie_notes: n.winnie_notes || "", target_roles: n.target_roles || [], packages: n.packages || {},
    });
    setSections(prospect.cdp_sections || null);
    setApproved(prospect.plan_token ? { plan_token: prospect.plan_token } : null);
  }, [prospect]);

  const saveNotes = async () => { await api.put(`/admin/prospects/${prospect.id}/cdp-notes`, notes); toast.success("Notes saved"); };
  const setPkg = (key, role) => setNotes((n) => ({ ...n, packages: { ...n.packages, [key]: role } }));

  const draft = async () => {
    setBusy(true);
    try { await api.put(`/admin/prospects/${prospect.id}/cdp-notes`, notes); const { data } = await api.post(`/admin/prospects/${prospect.id}/cdp-draft`); setSections(data); toast.success("Draft ready — review & approve"); onChanged?.(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const saveSections = async () => { await api.put(`/admin/prospects/${prospect.id}/cdp-sections`, { sections }); toast.success("Saved"); };
  const approve = async () => {
    setBusy(true);
    try { await api.put(`/admin/prospects/${prospect.id}/cdp-sections`, { sections }); const { data } = await api.post(`/admin/prospects/${prospect.id}/cdp-approve`); setApproved(data); toast.success("Approved & plan link created"); onChanged?.(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const planUrl = approved?.plan_token ? `${window.location.origin}/plan/${approved.plan_token}` : "";
  const copyMsg = () => { navigator.clipboard.writeText((approved.wechat_message || "Your plan: {link}").replace("{link}", planUrl)); toast.success("WeChat message copied"); };
  const setList = (k, v) => setSections((s) => ({ ...s, [k]: v.split("\n").filter(Boolean) }));
  const setText = (k, v) => setSections((s) => ({ ...s, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title={prospect ? `CDP — ${prospect.first_name} ${prospect.last_name}` : ""} wide>
      {prospect && (
        <div className="space-y-5 text-sm" data-testid="cdp-modal">
          <div className="eyebrow">1 · Call notes</div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input-lux" placeholder="Pronoun (he/she/they)" value={notes.pronoun} onChange={(e) => setNotes({ ...notes, pronoun: e.target.value })} data-testid="cdp-pronoun" />
            <input className="input-lux" placeholder="Visa status" value={notes.visa_status} onChange={(e) => setNotes({ ...notes, visa_status: e.target.value })} />
            <input className="input-lux" placeholder="Education" value={notes.education} onChange={(e) => setNotes({ ...notes, education: e.target.value })} />
            <input className="input-lux" placeholder="Salary expectation" value={notes.salary_expectation} onChange={(e) => setNotes({ ...notes, salary_expectation: e.target.value })} />
          </div>
          <textarea className="input-lux" rows={2} placeholder="Experience summary" value={notes.experience_summary} onChange={(e) => setNotes({ ...notes, experience_summary: e.target.value })} />
          <textarea className="input-lux" rows={2} placeholder="Challenges" value={notes.challenges} onChange={(e) => setNotes({ ...notes, challenges: e.target.value })} />
          <textarea className="input-lux" rows={3} placeholder="Winnie's notes (required for drafting)" value={notes.winnie_notes} onChange={(e) => setNotes({ ...notes, winnie_notes: e.target.value })} data-testid="cdp-winnie-notes" />

          <div className="eyebrow">2 · Packages</div>
          <div className="space-y-2">
            {packages.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3">
                <span className="text-slate-700">{p.name}</span>
                <select className="input-lux !py-1.5 max-w-[180px]" value={notes.packages[p.key] || "not"} onChange={(e) => setPkg(p.key, e.target.value)} data-testid={`cdp-pkg-${p.key}`}>
                  <option value="not">Not included</option><option value="recommended">Recommended</option><option value="optional">Optional add-on</option>
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={saveNotes} className="btn-outline !py-1.5 !text-xs" data-testid="cdp-save-notes">Save notes</button>
            <button onClick={draft} disabled={busy} className="btn-navy !py-1.5 !text-xs disabled:opacity-50" data-testid="cdp-draft">{busy ? "Drafting…" : "Draft CDP with Claude"}</button>
          </div>

          {sections && (
            <>
              <div className="eyebrow">3 · Review & edit</div>
              {LIST_KEYS.map((k) => (
                <div key={k}>
                  <div className="text-xs text-slate-500 mb-1 capitalize">{k.replace(/_/g, " ")} (one per line)</div>
                  <textarea className="input-lux" rows={3} value={(sections[k] || []).join("\n")} onChange={(e) => setList(k, e.target.value)} data-testid={`cdp-sec-${k}`} />
                </div>
              ))}
              {TEXT_KEYS.map((k) => (
                <div key={k}>
                  <div className="text-xs text-slate-500 mb-1 capitalize">{k.replace(/_/g, " ")}</div>
                  <textarea className="input-lux" rows={3} value={sections[k] || ""} onChange={(e) => setText(k, e.target.value)} />
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={saveSections} className="btn-outline !py-1.5 !text-xs">Save edits</button>
                <button onClick={approve} disabled={busy} className="btn-gold !py-1.5 !text-xs disabled:opacity-50" data-testid="cdp-approve">{busy ? "Approving…" : "Approve & create plan link"}</button>
              </div>
            </>
          )}

          {approved?.plan_token && (
            <div className="card-lux p-4" data-testid="cdp-approved">
              <div className="eyebrow mb-2">Plan ready to send</div>
              <a href={planUrl} target="_blank" rel="noreferrer" className="text-amber-700 underline break-all text-xs">{planUrl}</a>
              <button onClick={copyMsg} className="btn-navy !py-1.5 !text-xs mt-3" data-testid="cdp-copy-wechat">Copy WeChat message</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
