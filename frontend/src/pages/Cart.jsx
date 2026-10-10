import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Tag, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, errMsg } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Empty } from "@/components/Shared";
import { TERMS_ACCEPT_VERSION } from "@/lib/legalContent";

export default function Cart() {
  const cart = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);

  const payload = () => ({ items: cart.items.map((i) => ({ type: i.type, id: i.id })), coupon_code: code || null, origin_url: window.location.origin, terms_version: TERMS_ACCEPT_VERSION });

  const applyCoupon = async () => {
    if (!user) { nav("/login?next=/cart"); return; }
    try { const { data } = await api.post("/payments/validate-coupon", payload()); setQuote(data); toast.success("Coupon applied"); }
    catch (e) { setQuote(null); toast.error(errMsg(e)); }
  };

  const checkout = async () => {
    if (!user) { nav("/login?next=/cart"); return; }
    if (!agree) { toast.error("Please agree to the Terms and Privacy Policy to continue."); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/payments/checkout", payload());
      cart.clear();
      window.location.href = data.checkout_url;
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };

  const total = quote ? quote.total : cart.subtotal;

  return (
    <div className="max-w-5xl mx-auto px-6 py-16" data-testid="cart-page">
      <PageHeader tone="light" eyebrow="Your cart" title={`${cart.count} item${cart.count === 1 ? "" : "s"}`} />
      {cart.count === 0 ? (
        <Empty tone="light" title="Your cart is empty" hint="Browse the catalog or the workbook shop to get started." cta={<Link to="/courses" className="btn-gold" data-testid="cart-browse-btn">Browse courses</Link>} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-4">
            {cart.items.map((i) => (
              <div key={i.id} className="card-lux p-4 flex items-center gap-4" data-testid={`cart-item-${i.id}`}>
                <img src={i.image} alt="" className="w-24 h-16 object-cover rounded-md bg-stone-100" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-slate-400">{i.type}</div>
                  <div className="font-serif text-lg text-[#0A192F] truncate">{i.title}</div>
                </div>
                <div className="font-medium">{fmt(i.price)}</div>
                <button onClick={() => { cart.remove(i.id); setQuote(null); }} className="p-2 text-slate-400 hover:text-red-600 transition-colors" data-testid={`remove-item-${i.id}`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <div className="lg:col-span-5">
            <div className="card-lux p-7 sticky top-24">
              <div className="label-lux">Coupon code</div>
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LAUNCH20" className="input-lux font-mono" data-testid="coupon-input" />
                <button onClick={applyCoupon} className="btn-outline shrink-0" data-testid="apply-coupon-btn"><Tag size={14} /> Apply</button>
              </div>
              <div className="mt-6 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span data-testid="cart-subtotal">{fmt(cart.subtotal)}</span></div>
                {quote?.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount ({quote.coupon.code})</span><span data-testid="cart-discount">− {fmt(quote.discount)}</span></div>}
                <div className="flex justify-between font-serif text-2xl text-[#0A192F] pt-3 border-t border-slate-200"><span>Total</span><span data-testid="cart-total">{fmt(total)}</span></div>
                <p className="text-xs text-slate-400">Tax calculated at checkout where applicable.</p>
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-500 mt-5"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" data-testid="checkout-consent" /> I agree to the <Link to="/terms" target="_blank" className="text-amber-700 hover:underline">Terms</Link> and <Link to="/privacy" target="_blank" className="text-amber-700 hover:underline">Privacy Policy</Link>.</label>
              <button onClick={checkout} disabled={busy} className="btn-gold w-full mt-4 disabled:opacity-60" data-testid="checkout-btn">{busy ? "Redirecting…" : <>Secure checkout <ArrowRight size={16} /></>}</button>
              {!user && <p className="text-xs text-center text-slate-500 mt-3">You'll be asked to sign in first.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
