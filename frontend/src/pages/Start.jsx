import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Check, Calendar, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { servicePrice, CALENDLY_URL, STRIPE_DEPOSIT_URL } from "@/lib/config";

export default function Start() {
  const [sp] = useSearchParams();
  const name = sp.get("name");
  const lead = sp.get("lead");
  const [pkgs, setPkgs] = useState(null);
  const logged = useRef(false);

  useEffect(() => {
    api.get("/services").then((r) => setPkgs(r.data)).catch(() => setPkgs([]));
    if (lead && !logged.current) {
      logged.current = true;
      api.post("/lead-visits", { lead, name: name || "" }).catch(() => {});
    }
  }, [lead, name]);

  const book = () => {
    try {
      const u = new URL(CALENDLY_URL);
      if (lead) u.searchParams.set("utm_content", lead);
      window.open(u.toString(), "_blank");
    } catch { window.open(CALENDLY_URL, "_blank"); }
  };

  if (pkgs === null) return <Spinner />;

  return (
    <div data-testid="start-page">
      <section className="bg-[#0A192F] text-white">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <div className="eyebrow !text-amber-400 mb-4">Your personalised plan</div>
          <h1 className="font-serif text-4xl sm:text-5xl" data-testid="start-greeting">Hi {name || "there"},</h1>
          <p className="text-slate-300 mt-5 max-w-2xl mx-auto text-lg">Here are the coaching packages we discussed in your Career Development Plan. Choose the path that fits, then book your strategy call with Winnie.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
            {CALENDLY_URL && <button onClick={book} className="btn-gold" data-testid="start-book-btn"><Calendar size={16} /> Book your strategy call</button>}
            {STRIPE_DEPOSIT_URL && <a href={STRIPE_DEPOSIT_URL} target="_blank" rel="noreferrer" className="btn-outline !text-white !border-white/30" data-testid="start-deposit-btn"><CreditCard size={16} /> Pay deposit</a>}
            {!CALENDLY_URL && !STRIPE_DEPOSIT_URL && <Link to="/contact" className="btn-gold" data-testid="start-enquire-btn">Enquire with Winnie</Link>}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pkgs.map((p) => {
            const price = servicePrice(p);
            const best = p.key === "bundle";
            return (
              <div key={p.id} data-testid={`start-card-${p.key}`} className={`card-lux p-7 flex flex-col relative ${best ? "ring-2 ring-amber-400" : ""}`}>
                {best && <span className="absolute -top-3 left-1/2 -translate-x-1/2 gold-badge !bg-amber-500 !text-[#0A192F] !border-amber-500">Best value</span>}
                <h3 className="font-serif text-xl text-[#0A192F]">{p.name}</h3>
                {p.tagline && <p className="text-sm text-amber-700 mt-1">{p.tagline}</p>}
                <div className="mt-4">
                  <div className="font-serif text-2xl text-[#0A192F]" data-testid={`start-price-${p.key}`}>{price.main}</div>
                  {price.sub && <div className="text-xs text-slate-500">{price.sub}</div>}
                </div>
                <ul className="mt-5 space-y-2 text-sm text-slate-600 flex-1">
                  {(p.inclusions || []).map((inc, i) => <li key={i} className="flex gap-2"><Check size={15} className="text-amber-600 shrink-0 mt-0.5" />{inc}</li>)}
                </ul>
                {CALENDLY_URL && <button onClick={book} className="btn-navy w-full mt-6" data-testid={`start-cta-${p.key}`}><Calendar size={15} /> Book a call</button>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
