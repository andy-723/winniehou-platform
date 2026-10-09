import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Check, Calendar, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { servicePrice, STRIPE_DEPOSIT_URL } from "@/lib/config";

export default function Start() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
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

  const book = () => navigate(`/book?src=start${lead ? `&lead=${encodeURIComponent(lead)}` : ""}`);

  if (pkgs === null) return <Spinner />;

  return (
    <div className="bg-[#0A192F] min-h-screen" data-testid="start-page">
      <section className="bg-[#0A192F] text-white">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <div className="eyebrow !text-amber-400 mb-4">Your personalised plan</div>
          <h1 className="font-serif text-4xl sm:text-5xl" data-testid="start-greeting">Hi {name || "there"},</h1>
          <p className="text-slate-300 mt-5 max-w-2xl mx-auto text-lg">Here are the coaching packages we discussed in your Career Development Plan. Choose the path that fits, then book your strategy call with Winnie.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
            <button onClick={book} className="btn-gold" data-testid="start-book-btn"><Calendar size={16} /> Book your consultation</button>
            {STRIPE_DEPOSIT_URL && <a href={STRIPE_DEPOSIT_URL} target="_blank" rel="noreferrer" className="btn-outline !text-white !border-white/30" data-testid="start-deposit-btn"><CreditCard size={16} /> Pay deposit</a>}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pkgs.map((p) => {
            const price = servicePrice(p);
            return (
              <div key={p.id} data-testid={`start-card-${p.key}`} className="card-dark p-7 flex flex-col relative transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-[#D4AF37]/50">
                <h3 className="font-serif text-xl text-[#F9F8F3]">{p.name}</h3>
                {p.tagline && <p className="text-sm text-amber-400 mt-1">{p.tagline}</p>}
                <div className="mt-4">
                  <div className="font-serif text-2xl text-[#F9F8F3]" data-testid={`start-price-${p.key}`}>{price.main}</div>
                  {price.sub && <div className="text-xs text-slate-400">{price.sub}</div>}
                </div>
                <ul className="mt-5 space-y-2 text-sm text-slate-300 flex-1">
                  {(p.inclusions || []).map((inc, i) => <li key={i} className="flex gap-2"><Check size={15} className="text-amber-500 shrink-0 mt-0.5" />{inc}</li>)}
                </ul>
                <button onClick={book} className="btn-navy w-full mt-6" data-testid={`start-cta-${p.key}`}><Calendar size={15} /> Book a consultation</button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
