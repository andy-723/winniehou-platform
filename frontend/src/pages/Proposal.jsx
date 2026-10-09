import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Check, CreditCard, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { TERMS_PARTS } from "@/lib/legalContent";

const coaching = TERMS_PARTS.find((p) => p.anchor === "coaching");

export default function Proposal() {
  const { token } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [addons, setAddons] = useState([]);
  const [step, setStep] = useState(1);
  const [agree, setAgree] = useState(false);
  const [form, setForm] = useState({ full_name: "", preferred_name: "", email: "", mobile: "", address: "", signature: "" });
  const [busy, setBusy] = useState(false);

  const loadQuote = (ak) => api.get(`/plan/${token}/proposal`, { params: { addons: ak.join(",") } }).then((r) => setData(r.data));
  useEffect(() => {
    api.get(`/plan/${token}/proposal`).then((r) => { setData(r.data); setForm((f) => ({ ...f, ...r.data.details })); }).catch(() => setData(false));
  }, [token]); // eslint-disable-line

  if (data === null) return <div className="bg-[#0A192F] min-h-screen"><Spinner /></div>;
  if (data === false) return <div className="bg-[#0A192F] min-h-screen flex items-center justify-center text-slate-400">This proposal link is not valid.</div>;
  if (data.paid) return <div className="bg-[#0A192F] min-h-screen flex items-center justify-center text-amber-300">You're already a client — thank you!</div>;

  const toggleAddon = (key) => { const next = addons.includes(key) ? addons.filter((k) => k !== key) : [...addons, key]; setAddons(next); loadQuote(next); };
  const included = data.lines.filter((l) => l.included);

  const doAccept = async () => {
    if (!agree) { toast.error("Please agree to the Terms and Conditions"); return; }
    if (!form.full_name || !form.signature) { toast.error("Full name and signature are required"); return; }
    setBusy(true);
    try { await api.post(`/plan/${token}/accept`, { ...form, consent: agree, addons }); toast.success("Accepted & signed"); setStep(4); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const pay = async () => {
    setBusy(true);
    try { const { data: r } = await api.post(`/plan/${token}/checkout`, { addons, origin_url: window.location.origin }); window.location.href = r.url; }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };

  return (
    <div className="bg-[#0A192F] min-h-screen" data-testid="proposal-page">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="eyebrow !text-amber-400 mb-2">Your proposal</div>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#F9F8F3]">Scope of works for {data.preferred_name}</h1>

        <div className="mt-8 space-y-4">
          {data.lines.map((l) => (
            <div key={l.key} className={`card-dark p-5 ${l.included ? "!border-amber-400/50" : ""}`} data-testid={`prop-line-${l.key}`}>
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h3 className="font-serif text-lg text-[#F9F8F3]">{l.name}</h3>
                  {l.description && <p className="text-sm text-slate-400 mt-1">{l.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-serif text-xl text-[#F9F8F3]">{fmt(l.inc_cents, "AUD")}</div>
                  <div className="text-xs text-slate-500">inc GST</div>
                </div>
              </div>
              {(l.inclusions || []).length > 0 && <ul className="mt-3 space-y-1 text-sm text-slate-300">{l.inclusions.map((inc, i) => <li key={i} className="flex gap-2"><Check size={14} className="text-amber-500 shrink-0 mt-1" />{inc}</li>)}</ul>}
              {l.optional && <label className="flex items-center gap-2 text-xs text-amber-300 mt-3"><input type="checkbox" checked={addons.includes(l.key)} onChange={() => toggleAddon(l.key)} data-testid={`prop-addon-${l.key}`} /> Add this optional package</label>}
            </div>
          ))}
        </div>

        <div className="card-dark p-5 mt-6 flex justify-between items-center" data-testid="prop-total">
          <span className="text-slate-300">Total payable (inc GST)</span>
          <span className="font-serif text-2xl text-amber-400">{fmt(data.total_cents, "AUD")}</span>
        </div>

        <details className="mt-8 card-dark p-5">
          <summary className="cursor-pointer text-[#F9F8F3] font-serif">Terms & Conditions ({data.terms_version})</summary>
          <ol className="list-decimal ml-5 mt-4 space-y-2 text-xs text-slate-400 max-h-72 overflow-auto">
            {(coaching?.items || []).map((it, i) => <li key={i}><strong className="text-slate-200">{it.t}. </strong>{Array.isArray(it.d) ? it.d.join(" ") : it.d}</li>)}
          </ol>
        </details>

        {step === 1 && (
          <div className="mt-8">
            <label className="flex items-start gap-2 text-sm text-slate-200"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" data-testid="prop-agree" /> I have read and agree to the Terms and Conditions.</label>
            <button onClick={() => agree ? setStep(2) : toast.error("Please agree to continue")} className="btn-gold mt-5" data-testid="prop-accept-step">Accept & continue <ArrowRight size={16} /></button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-3" data-testid="prop-details">
            <div className="eyebrow-dark">Your details</div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input-dark" placeholder="Full legal name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} data-testid="prop-name" />
              <input className="input-dark" placeholder="Preferred name" value={form.preferred_name} onChange={(e) => setForm({ ...form, preferred_name: e.target.value })} />
              <input className="input-dark" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="prop-email" />
              <input className="input-dark" placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <input className="input-dark" placeholder="Residential address (for tax invoice)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <button onClick={() => (form.full_name && form.email) ? setStep(3) : toast.error("Name and email required")} className="btn-gold" data-testid="prop-to-sign">Continue to sign</button>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-3" data-testid="prop-sign">
            <div className="eyebrow-dark">Sign</div>
            <p className="text-sm text-slate-400">Type your full name to sign. Dated {new Date().toLocaleDateString("en-AU")}.</p>
            <input className="input-dark !font-serif !text-xl" placeholder="Your signature" value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} data-testid="prop-signature" />
            <button onClick={doAccept} disabled={busy} className="btn-gold disabled:opacity-60" data-testid="prop-sign-btn">{busy ? "Signing…" : "Accept & sign"}</button>
          </div>
        )}

        {step === 4 && (
          <div className="mt-8 space-y-3 text-center" data-testid="prop-pay">
            <p className="text-slate-300">Signed — final step is payment.</p>
            <button onClick={pay} disabled={busy} className="btn-gold disabled:opacity-60" data-testid="prop-pay-btn"><CreditCard size={16} /> {busy ? "Redirecting…" : `Pay ${fmt(data.total_cents, "AUD")}`}</button>
          </div>
        )}
      </div>
    </div>
  );
}
