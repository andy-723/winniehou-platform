import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Download, ArrowRight, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { TERMS_PARTS } from "@/lib/legalContent";

const Band = ({ title, children }) => (
  <section className="border-b border-white/10 py-10">
    <div className="max-w-3xl mx-auto px-6">
      <h2 className="font-serif text-2xl text-[#F9F8F3] mb-4">{title}</h2>
      {children}
    </div>
  </section>
);
const Bullets = ({ items }) => <ul className="space-y-2 text-slate-300">{(items || []).map((x, i) => <li key={i} className="flex gap-2"><Check size={15} className="text-amber-500 shrink-0 mt-1" />{x}</li>)}</ul>;

export default function Plan() {
  const { token } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const paid = sp.get("paid");

  useEffect(() => {
    api.get(`/plan/${token}`).then((r) => setData(r.data)).catch(() => setData(false));
    if (paid) api.get(`/plan/${token}/confirm`, { params: { session_id: paid } }).then((r) => { if (r.data.status === "paid") { toast.success("Payment received — you're now a client!"); setData((d) => d ? { ...d, paid: true } : d); } }).catch(() => {});
  }, [token, paid]);

  if (data === null) return <div className="bg-[#0A192F] min-h-screen"><Spinner /></div>;
  if (data === false) return <div className="bg-[#0A192F] min-h-screen flex items-center justify-center text-slate-400">This plan link is not valid or has expired.</div>;
  const s = data.sections || {};

  return (
    <div className="bg-[#0A192F] min-h-screen" data-testid="plan-page">
      <section className="py-20 text-center px-6">
        <div className="eyebrow !text-amber-400 mb-3">Better Careers</div>
        <h1 className="font-serif text-4xl sm:text-5xl text-[#F9F8F3]">{data.preferred_name}, your Career Development Plan</h1>
        <div className="flex flex-wrap gap-3 justify-center mt-8">
          {data.pdf && <a href={`${api.defaults.baseURL}/plan/${token}/pdf`} target="_blank" rel="noreferrer" className="btn-outline !text-white !border-white/30 !bg-transparent" data-testid="plan-pdf"><Download size={16} /> Download PDF</a>}
          {data.paid ? <span className="btn-gold !cursor-default" data-testid="plan-paid">You're a client 🎉</span> :
            <button onClick={() => nav(`/plan/${token}/proposal`)} className="btn-gold" data-testid="plan-proposal-cta">View your proposal <ArrowRight size={16} /></button>}
        </div>
      </section>
      {(s.current_situation?.length || s.current_challenges?.length) ? <Band title="What we heard"><Bullets items={s.current_situation} /><div className="mt-4" /><Bullets items={s.current_challenges} /></Band> : null}
      {(s.background || s.career_recommendation) ? <Band title="Action plan"><div className="text-slate-300 space-y-3 whitespace-pre-line">{s.background}{"\n\n"}{s.career_recommendation}</div></Band> : null}
      {s.goals?.length ? <Band title="Goals"><Bullets items={s.goals} /></Band> : null}
      {s.development_focus?.length ? <Band title="Development focus"><Bullets items={s.development_focus} /></Band> : null}
      {s.support_approach?.length ? <Band title="How Winnie will support you"><Bullets items={s.support_approach} /></Band> : null}
      {s.milestone_table?.length ? <Band title="Milestones"><div className="space-y-2">{s.milestone_table.map((m, i) => <div key={i} className="flex gap-4 text-slate-300"><span className="text-amber-400 w-24 shrink-0">{m.timeframe}</span><span>{m.action}</span></div>)}</div></Band> : null}
      {s.target_roles?.length ? <Band title="Target roles"><div className="space-y-3">{s.target_roles.map((r, i) => <div key={i} className="text-slate-300"><div className="text-[#F9F8F3]">{r.role} · <span className="text-amber-400">{r.industry}</span></div><div className="text-sm">{r.approach}</div></div>)}</div></Band> : null}
      {!data.paid && <section className="py-12 text-center"><button onClick={() => nav(`/plan/${token}/proposal`)} className="btn-gold" data-testid="plan-proposal-cta2">View your proposal <ArrowRight size={16} /></button></section>}
    </div>
  );
}
