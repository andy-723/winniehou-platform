import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/Shared";
import { LEGAL_UPDATED, DRAFT_BANNER, TERMS_PARTS, DISCLAIMER, PRIVACY } from "@/lib/legalContent";

const Clause = ({ item }) => (
  <li className="text-sm text-slate-300 leading-relaxed">
    {item.t && <strong className="text-[#F9F8F3]">{item.t}. </strong>}
    {Array.isArray(item.d) ? (
      <ul className="list-disc ml-5 mt-2 space-y-1.5 text-slate-400">
        {item.d.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    ) : (
      <span className="text-slate-400">{item.d}</span>
    )}
  </li>
);

const Section = ({ s }) => (
  <section id={s.anchor} className="scroll-mt-24">
    <h2 className="font-serif text-2xl text-[#F9F8F3]">{s.title}{s.version && <span className="text-xs font-sans text-slate-500 ml-3">Version {s.version}</span>}</h2>
    {s.intro && <p className="text-sm text-slate-400 mt-2">{s.intro}</p>}
    <ol className="list-decimal ml-5 mt-4 space-y-3">
      {s.items.map((item, i) => <Clause key={i} item={item} />)}
    </ol>
    {s.note && <p className="text-xs text-slate-400 italic mt-4 border-l-2 border-amber-500/50 pl-4">{s.note}</p>}
  </section>
);

const Shell = ({ eyebrow, title, sub, children }) => (
  <div className="bg-[#0A192F] min-h-screen" data-testid="legal-page">
    <div className="max-w-3xl mx-auto px-6 py-16">
      <PageHeader eyebrow={eyebrow} title={title} sub={sub} />
      <div className="flex items-start gap-3 card-dark p-4 mb-10 border-amber-500/30" data-testid="legal-draft-banner">
        <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400">{DRAFT_BANNER} Last updated {LEGAL_UPDATED}.</p>
      </div>
      {children}
    </div>
  </div>
);

export function Terms() {
  return (
    <Shell eyebrow="Legal" title="Terms & Conditions" sub="The rules for using this website, our courses, shop and coaching services.">
      <nav className="flex flex-wrap gap-2 mb-10" data-testid="terms-nav">
        {TERMS_PARTS.map((p) => (
          <a key={p.anchor} href={`#${p.anchor}`} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:border-amber-500/50 hover:text-amber-300 transition-colors" data-testid={`terms-jump-${p.anchor}`}>{p.title.replace(/^Part [A-D] — /, "")}</a>
        ))}
      </nav>
      <div className="space-y-14">
        {TERMS_PARTS.map((p) => <Section key={p.anchor} s={p} />)}
      </div>
      <p className="text-sm text-slate-500 mt-12">See also our <Link to="/privacy" className="text-amber-400 hover:underline">Privacy Policy</Link> and <Link to="/disclaimer" className="text-amber-400 hover:underline">Disclaimer</Link>.</p>
    </Shell>
  );
}

export function Disclaimer() {
  return (
    <Shell eyebrow="Legal" title="Disclaimer" sub="What our coaching and courses can and cannot do.">
      <ol className="list-decimal ml-5 space-y-3">
        {DISCLAIMER.items.map((item, i) => <Clause key={i} item={item} />)}
      </ol>
      <p className="text-sm text-slate-500 mt-12">See also our <Link to="/terms" className="text-amber-400 hover:underline">Terms & Conditions</Link> and <Link to="/privacy" className="text-amber-400 hover:underline">Privacy Policy</Link>.</p>
    </Shell>
  );
}

export function Privacy() {
  return (
    <Shell eyebrow="Legal" title="Privacy Policy" sub={`How we collect, use and protect your personal information. Version ${PRIVACY.version}.`}>
      <ol className="list-decimal ml-5 space-y-3">
        {PRIVACY.items.map((item, i) => <Clause key={i} item={item} />)}
      </ol>
      <div className="card-dark p-5 mt-8 overflow-x-auto" data-testid="privacy-sharing-table">
        <div className="eyebrow-dark mb-3">Who we share data with</div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="text-left py-2">Provider</th><th className="text-left py-2">Purpose</th><th className="text-left py-2">Where data may be stored</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {PRIVACY.sharing.map((r) => (
              <tr key={r.provider}><td className="py-2 text-slate-200">{r.provider}</td><td className="py-2 text-slate-400">{r.purpose}</td><td className="py-2 text-slate-400">{r.location}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500 mt-12">See also our <Link to="/terms" className="text-amber-400 hover:underline">Terms & Conditions</Link> and <Link to="/disclaimer" className="text-amber-400 hover:underline">Disclaimer</Link>.</p>
    </Shell>
  );
}

// Short disclaimer shown under coaching packages and on course pages.
export const ShortDisclaimer = ({ className = "" }) => (
  <p className={`text-xs text-slate-500 ${className}`} data-testid="short-disclaimer">
    {DISCLAIMER.short} See our <Link to="/disclaimer" className="text-amber-400 hover:underline">Disclaimer</Link> and <Link to="/terms" className="text-amber-400 hover:underline">Terms</Link>.
  </p>
);
