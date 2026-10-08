import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Calendar, Mail, Sparkles } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { PageHeader, Spinner, Empty } from "@/components/Shared";
import { PUBLIC_PRICING, servicePrice, CALENDLY_URL } from "@/lib/config";

export default function Services() {
  const [pkgs, setPkgs] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", package: "", message: "", consent: false });
  const [wl, setWl] = useState({ name: "", email: "" });
  const [sent, setSent] = useState(false);
  const [wlSent, setWlSent] = useState(false);

  useEffect(() => { api.get("/services").then((r) => setPkgs(r.data)).catch(() => setPkgs([])); }, []);

  const preselect = (key) => { setForm((f) => ({ ...f, package: key })); document.getElementById("services-enquiry")?.scrollIntoView({ behavior: "smooth" }); };
  const book = (key) => window.open(`${CALENDLY_URL}?utm_content=${encodeURIComponent(key)}`, "_blank");

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

  if (pkgs === null) return <Spinner />;

  return (
    <div className="max-w-7xl mx-auto px-6 py-16" data-testid="services-page">
      <PageHeader eyebrow="Services" title="Coaching with Winnie" sub="One-to-one and small-group coaching built around your career goals. [SERVICES INTRO TO COME]" />

      {pkgs.length === 0 ? <Empty title="Coming soon" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pkgs.map((p) => {
            const price = servicePrice(p);
            const best = p.key === "bundle";
            return (
              <div key={p.id} data-testid={`service-card-${p.key}`} className={`card-lux p-7 flex flex-col relative ${best ? "ring-2 ring-amber-400" : ""}`}>
                {best && <span className="absolute -top-3 left-1/2 -translate-x-1/2 gold-badge !bg-amber-500 !text-[#0A192F] !border-amber-500">Best value</span>}
                <h3 className="font-serif text-xl text-[#0A192F]">{p.name}</h3>
                {p.tagline && <p className="text-sm text-amber-700 mt-1">{p.tagline}</p>}
                <div className="mt-4">
                  {PUBLIC_PRICING ? (
                    <><div className="font-serif text-2xl text-[#0A192F]" data-testid={`service-price-${p.key}`}>{price.main}</div>{price.sub && <div className="text-xs text-slate-500">{price.sub}</div>}</>
                  ) : (
                    <div className="font-serif text-2xl text-[#0A192F]" data-testid={`service-price-${p.key}`}>POA</div>
                  )}
                </div>
                {p.duration_label && <div className="text-xs text-slate-400 mt-1">{p.duration_label}</div>}
                <ul className="mt-5 space-y-2 text-sm text-slate-600 flex-1">
                  {(p.inclusions || []).map((inc, i) => <li key={i} className="flex gap-2"><Check size={15} className="text-amber-600 shrink-0 mt-0.5" />{inc}</li>)}
                </ul>
                <div className="mt-6">
                  {p.cta_type === "book_call" && CALENDLY_URL ? (
                    <button onClick={() => book(p.key)} className="btn-gold w-full" data-testid={`service-cta-${p.key}`}><Calendar size={15} /> Book a call</button>
                  ) : (
                    <button onClick={() => preselect(p.key)} className="btn-navy w-full" data-testid={`service-cta-${p.key}`}><Mail size={15} /> Enquire</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div id="services-enquiry" className="card-lux p-8 mt-16 max-w-2xl mx-auto" data-testid="services-enquiry">
        <h2 className="font-serif text-2xl text-[#0A192F] mb-1">Enquire about coaching</h2>
        <p className="text-sm text-slate-500 mb-6">Tell us a little about your goals and we'll be in touch.</p>
        {sent ? (
          <div className="text-emerald-700" data-testid="enquiry-success">Thank you — your enquiry has been sent. Winnie's team will reach out shortly.</div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input className="input-lux" placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="enquiry-name" />
            <input className="input-lux" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="enquiry-email" />
            <input className="input-lux" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="enquiry-phone" />
            <select className="input-lux" value={form.package} onChange={(e) => setForm({ ...form, package: e.target.value })} data-testid="enquiry-package"><option value="">Which service?</option>{pkgs.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
            <textarea className="input-lux" rows={4} placeholder="Your message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} data-testid="enquiry-message" />
            <label className="flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1" data-testid="enquiry-consent" /> I agree to be contacted about my enquiry.</label>
            <button className="btn-gold w-full" data-testid="enquiry-submit">Send enquiry</button>
          </form>
        )}
      </div>

      <div className="mt-16 max-w-2xl mx-auto text-center" data-testid="oneonone-section">
        <span className="gold-badge"><Sparkles size={12} className="mr-1" /> Coming soon</span>
        <h2 className="font-serif text-2xl text-[#0A192F] mt-4">1-on-1 Coaching</h2>
        <p className="text-sm text-slate-500 mt-2">[1-ON-1 DESCRIPTION TO COME] Register your interest and we'll let you know when places open.</p>
        {wlSent ? (
          <div className="text-emerald-700 mt-4" data-testid="waitlist-success">You're on the waitlist — thank you!</div>
        ) : (
          <form onSubmit={joinWl} className="flex flex-col sm:flex-row gap-3 mt-6">
            <input className="input-lux" placeholder="Name" required value={wl.name} onChange={(e) => setWl({ ...wl, name: e.target.value })} data-testid="waitlist-name" />
            <input className="input-lux" type="email" placeholder="Email" required value={wl.email} onChange={(e) => setWl({ ...wl, email: e.target.value })} data-testid="waitlist-email" />
            <button className="btn-navy shrink-0" data-testid="waitlist-submit">Register interest</button>
          </form>
        )}
      </div>
    </div>
  );
}
