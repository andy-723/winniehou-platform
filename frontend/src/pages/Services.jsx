import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Calendar, Sparkles, ChevronDown } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { Spinner, Empty } from "@/components/Shared";
import { ShortDisclaimer } from "@/pages/Legal";
import { formatAud, incGstCents, servicePrice } from "@/lib/config";

const CHAPTER_ANCHOR = {
  "interview-for-success": "interview",
  "business-english-quantum-leap": "quantum-leap",
};

const STEPS = [
  { n: "01", title: "Discovery call", text: "A conversation about where you are and where you want to be. Book a time that suits you." },
  { n: "02", title: "Your plan", text: "Winnie writes your Career Development Plan, with the program she recommends and a clear quote." },
  { n: "03", title: "Confirm online", text: "Read the plan, accept the terms and pay securely. No surprises later." },
  { n: "04", title: "Coaching begins", text: "Your sessions start and you work through the plan together, with progress tracked as you go." },
];

function scrollToId(id) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export default function Services() {
  const navigate = useNavigate();
  const [pkgs, setPkgs] = useState(null);
  const [active, setActive] = useState("");
  const [openFaq, setOpenFaq] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", phone: "", package: "", message: "", consent: false });
  const [wl, setWl] = useState({ name: "", email: "" });
  const [sent, setSent] = useState(false);
  const [wlSent, setWlSent] = useState(false);

  useEffect(() => { api.get("/services").then((r) => setPkgs(r.data)).catch(() => setPkgs([])); }, []);

  useEffect(() => {
    if (!pkgs?.length) return;
    setActive((cur) => cur || pkgs[0].key);
    const els = pkgs.map((p) => document.getElementById(`program-${p.key}`)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const key = vis?.target?.id?.replace("program-", "");
      if (key) setActive(key);
    }, { rootMargin: "-30% 0px -50% 0px", threshold: [0.15, 0.4, 0.7] });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pkgs]);

  const preselect = (key) => { setForm((f) => ({ ...f, package: key })); scrollToId("services-enquiry"); };
  const book = (key) => navigate(key ? `/book?src=website&pkg=${encodeURIComponent(key)}` : "/book?src=website");

  const submit = async (e) => {
    e.preventDefault();
    if (!form.consent) { toast.error("Please agree to be contacted."); return; }
    try { await api.post("/service-enquiries", { ...form, type: "service" }); setSent(true); toast.success("Enquiry sent"); }
    catch (err) { toast.error(errMsg(err)); }
  };
  const joinWl = async (e) => {
    e.preventDefault();
    try { await api.post("/waitlist", { ...wl, source: "1on1" }); setWlSent(true); toast.success("You're on the list"); }
    catch (err) { toast.error(errMsg(err)); }
  };

  if (pkgs === null) return <div className="bg-[#0A192F] min-h-screen"><Spinner /></div>;

  const essentials = pkgs.find((p) => p.key === "career-coaching-essentials");
  const interview = pkgs.find((p) => p.key === "interview-for-success");
  const together = essentials && interview ? `${formatAud(incGstCents(essentials) + incGstCents(interview))} inc GST` : null;

  const faqs = [
    { q: "Which program should I start with?", a: "If you're not sure, book the discovery call. Winnie will recommend one in your Career Development Plan, and you only commit once you've read it." },
    { q: "Can I take Essentials and Interview for Success together?", a: together ? `Yes. Each program is priced on its own. Taken together, the total is ${together}.` : "Yes. Each program is priced on its own." },
    { q: "Do you guarantee I'll get a job?", a: "No one honestly can. Coaching improves how prepared and confident you are, but hiring decisions are made by employers. We also don't give migration or visa advice." },
  ];

  return (
    <div className="bg-[#0A192F] min-h-screen text-[#F9F8F3]" data-testid="services-page">
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-14 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7">
          <div className="eyebrow-dark mb-4">Services</div>
          <h1 className="font-serif text-4xl sm:text-5xl leading-tight tracking-tight">Your next role deserves a plan, not another application.</h1>
          <p className="text-lg text-slate-300 mt-5 max-w-xl">Winnie works one-to-one with professionals building a career in Australia. She starts by understanding where you are, writes a Career Development Plan around your goals, then works through it with you, session by session.</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <button onClick={() => book()} className="btn-gold" data-testid="hero-book"><Calendar size={15} /> Book a discovery call</button>
            <button onClick={() => scrollToId("starting-point")} className="btn-gold-outline" data-testid="hero-start">Find your starting point</button>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="aspect-[4/5] max-w-sm ml-auto rounded-xl border border-[#D4AF37]/30 bg-[#050E1E] flex flex-col justify-end p-8">
            <div className="gold-rule w-16 mb-5" />
            <div className="font-serif text-2xl">Winnie Hou</div>
            <div className="text-sm text-slate-400 mt-1">Founder</div>
          </div>
        </div>
      </section>

      {pkgs.length === 0 ? <div className="max-w-7xl mx-auto px-6 pb-16"><Empty title="Coming soon" /></div> : (
        <>
          <section id="starting-point" className="max-w-7xl mx-auto px-6 pb-16 scroll-mt-24">
            <h2 className="font-serif text-3xl">Which of these sounds like you?</h2>
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              {pkgs.map((p) => (
                <button key={p.key} type="button" onClick={() => scrollToId(`program-${p.key}`)}
                  className="card-dark p-6 text-left hover:border-[#D4AF37]/50 transition-colors" data-testid={`situation-${p.key}`}>
                  <p className="font-serif text-lg text-[#F9F8F3] leading-snug">“{p.situation_quote || p.tagline}”</p>
                  <p className="text-sm text-amber-400 mt-4">{p.name}</p>
                </button>
              ))}
            </div>
          </section>

          <section id="programs" className="border-t border-white/10">
            <div className="lg:hidden sticky top-16 z-40 bg-[#0A192F]/95 backdrop-blur border-b border-white/10">
              <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
                {pkgs.map((p) => (
                  <button key={p.key} type="button" onClick={() => scrollToId(`program-${p.key}`)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border ${active === p.key ? "bg-amber-500 text-[#0A192F] border-amber-500" : "border-white/15 text-slate-300"}`}
                    data-testid={`pill-${p.key}`}>{p.name}</button>
                ))}
              </div>
            </div>
            <div className="max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-12 gap-10">
              <nav className="hidden lg:block lg:col-span-3" aria-label="Programs">
                <div className="sticky top-24 space-y-1">
                  <div className="eyebrow-dark mb-3">Programs</div>
                  {pkgs.map((p) => (
                    <button key={p.key} type="button" onClick={() => scrollToId(`program-${p.key}`)}
                      className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${active === p.key ? "bg-white/5 text-amber-300" : "text-slate-400 hover:text-white"}`}
                      data-testid={`index-${p.key}`}>{p.name}</button>
                  ))}
                </div>
              </nav>
              <div className="lg:col-span-9 space-y-20">
                {pkgs.map((p) => {
                  const price = servicePrice(p);
                  return (
                    <article key={p.id} id={`program-${p.key}`} data-testid={`service-card-${p.key}`} className="scroll-mt-28 rise">
                      {CHAPTER_ANCHOR[p.key] && <span id={CHAPTER_ANCHOR[p.key]} className="block h-0 scroll-mt-28" />}
                      <h2 className="font-serif text-3xl sm:text-4xl">{p.name}</h2>
                      {p.tagline && <p className="italic text-amber-400 mt-2">{p.tagline}</p>}
                      {p.description && <p className="text-slate-300 mt-5 max-w-2xl leading-relaxed">{p.description}</p>}
                      <div className="grid md:grid-cols-2 gap-8 mt-8">
                        <div>
                          <h3 className="text-sm font-semibold tracking-wide text-[#F9F8F3]">This is for you if</h3>
                          <ul className="mt-3 space-y-2 text-sm text-slate-300">
                            {(p.for_you_if || []).map((line) => <li key={line} className="flex gap-2"><Check size={15} className="text-amber-500 shrink-0 mt-0.5" />{line}</li>)}
                          </ul>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold tracking-wide text-[#F9F8F3]">What we work on together</h3>
                          {p.outcomes_intro && <p className="text-sm text-slate-400 mt-2">{p.outcomes_intro}</p>}
                          <ul className="mt-3 space-y-2 text-sm text-slate-300">
                            {(p.inclusions || []).map((line) => <li key={line} className="flex gap-2"><Check size={15} className="text-amber-500 shrink-0 mt-0.5" />{line}</li>)}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-8 card-dark p-6 sm:flex sm:items-end sm:justify-between gap-6">
                        <div>
                          <div className="eyebrow-dark">Investment</div>
                          <div className="font-serif text-3xl mt-2" data-testid={`service-price-${p.key}`}>{price.main}</div>
                          {price.sub && <div className="text-xs text-slate-400 mt-1">{price.sub}</div>}
                          {p.duration_label && <div className="text-xs text-slate-500 mt-2">{p.duration_label}</div>}
                        </div>
                        <button onClick={() => book(p.key)} className="btn-gold mt-5 sm:mt-0 shrink-0" data-testid={`service-cta-${p.key}`}><Calendar size={15} /> Book a discovery call</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="max-w-7xl mx-auto px-6 py-16 border-t border-white/10">
            <h2 className="font-serif text-3xl">How it works</h2>
            <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
              {STEPS.map((s) => (
                <li key={s.n} className="card-dark p-6">
                  <div className="font-mono text-xs text-amber-400">{s.n}</div>
                  <h3 className="font-serif text-xl mt-2">{s.title}</h3>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="max-w-7xl mx-auto px-6 pb-16">
            <h2 className="font-serif text-3xl mb-6">Compare the programs</h2>
            <div className="overflow-x-auto border border-white/10 rounded-xl">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-left text-slate-400">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 font-medium">Program</th>
                    <th className="px-4 py-3 font-medium">Best when</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Investment</th>
                  </tr>
                </thead>
                <tbody>
                  {pkgs.map((p) => (
                    <tr key={p.key} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-4 font-serif text-base align-top">{p.name}</td>
                      <td className="px-4 py-4 text-slate-300 align-top">{p.situation_quote}</td>
                      <td className="px-4 py-4 text-slate-400 align-top">{p.duration_label || "—"}</td>
                      <td className="px-4 py-4 align-top whitespace-nowrap">{servicePrice(p).main}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="max-w-3xl mx-auto px-6 pb-16">
            <h2 className="font-serif text-3xl mb-6">Questions</h2>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {faqs.map((item, i) => (
                <div key={item.q}>
                  <button type="button" onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full flex items-center justify-between gap-4 py-4 text-left" data-testid={`faq-${i}`}>
                    <span className="font-medium">{item.q}</span>
                    <ChevronDown size={16} className={`shrink-0 text-amber-400 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && <p className="pb-4 text-sm text-slate-300 leading-relaxed">{item.a}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="max-w-7xl mx-auto px-6 pb-8">
            <div className="card-dark p-8 sm:p-12 text-center">
              <h2 className="font-serif text-3xl">Start with a conversation.</h2>
              <p className="text-slate-300 mt-3 max-w-xl mx-auto">Tell Winnie where you are and what you're aiming for. You'll leave the call knowing which program fits, or whether you need one at all.</p>
              <div className="flex flex-wrap justify-center gap-3 mt-6">
                <button onClick={() => book()} className="btn-gold"><Calendar size={15} /> Book a discovery call</button>
                <button onClick={() => scrollToId("starting-point")} className="btn-gold-outline">Find your starting point</button>
              </div>
            </div>
          </section>
        </>
      )}

      <ShortDisclaimer className="max-w-3xl mx-auto text-center mt-6 px-6" />

      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div id="services-enquiry" className="card-dark p-8 mt-16 max-w-2xl mx-auto scroll-mt-24" data-testid="services-enquiry">
          <h2 className="font-serif text-2xl text-[#F9F8F3] mb-1">Enquire about coaching</h2>
          <p className="text-sm text-slate-400 mb-6">Tell us a little about your goals and we'll be in touch.</p>
          {sent ? (
            <div className="text-emerald-400" data-testid="enquiry-success">Thank you — your enquiry has been sent. Winnie's team will reach out shortly.</div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <input className="input-dark" placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="enquiry-name" />
              <input className="input-dark" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="enquiry-email" />
              <input className="input-dark" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="enquiry-phone" />
              <select className="input-dark" value={form.package} onChange={(e) => setForm({ ...form, package: e.target.value })} data-testid="enquiry-package"><option value="">Which service?</option>{pkgs.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
              <textarea className="input-dark" rows={4} placeholder="Your message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} data-testid="enquiry-message" />
              <label className="flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1" data-testid="enquiry-consent" /> I agree to be contacted about my enquiry and to the <a href="/privacy" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">Privacy Policy</a>.</label>
              <button className="btn-gold w-full" data-testid="enquiry-submit">Send enquiry</button>
            </form>
          )}
        </div>

        <div className="mt-16 max-w-2xl mx-auto text-center" data-testid="oneonone-section">
          <span className="gold-badge"><Sparkles size={12} className="mr-1" /> Coming soon</span>
          <h2 className="font-serif text-2xl text-[#F9F8F3] mt-4">1-on-1 Coaching</h2>
          <p className="text-sm text-slate-400 mt-2">[1-ON-1 DESCRIPTION TO COME] Register your interest and we'll let you know when places open.</p>
          {wlSent ? (
            <div className="text-emerald-400 mt-4" data-testid="waitlist-success">You're on the waitlist — thank you!</div>
          ) : (
            <form onSubmit={joinWl} className="flex flex-col sm:flex-row gap-3 mt-6">
              <input className="input-dark" placeholder="Name" required value={wl.name} onChange={(e) => setWl({ ...wl, name: e.target.value })} data-testid="waitlist-name" />
              <input className="input-dark" type="email" placeholder="Email" required value={wl.email} onChange={(e) => setWl({ ...wl, email: e.target.value })} data-testid="waitlist-email" />
              <button className="btn-gold shrink-0" data-testid="waitlist-submit">Register interest</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
