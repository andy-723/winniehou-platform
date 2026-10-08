import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const directOrder = params.get("order_id");
  const { refresh } = useAuth();
  const [state, setState] = useState(directOrder ? "paid" : "checking");
  const [orderId, setOrderId] = useState(directOrder);

  useEffect(() => {
    if (!sessionId) return;
    let tries = 0;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") { setState("paid"); setOrderId(data.order_id); refresh(); return; }
        if (["expired", "failed"].includes(data.payment_status)) { setState("failed"); return; }
      } catch {}
      if (++tries < 10) setTimeout(poll, 2000); else setState("timeout");
    };
    poll();
  }, [sessionId, refresh]);

  return (
    <div className="max-w-xl mx-auto px-6 py-28 text-center" data-testid="payment-success-page">
      {state === "checking" && (<><Clock size={44} className="mx-auto text-amber-500 animate-pulse" /><h1 className="font-serif text-3xl mt-6">Confirming your payment…</h1><p className="text-slate-500 mt-3">This usually takes a few seconds.</p></>)}
      {state === "paid" && (<>
        <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
        <h1 className="font-serif text-4xl mt-6 text-[#0A192F]" data-testid="payment-success-title">You're enrolled.</h1>
        <p className="text-slate-500 mt-3">A receipt has been emailed to you. Your courses and downloads are ready in your dashboard.</p>
        <div className="flex justify-center gap-3 mt-10">
          <Link to="/dashboard" className="btn-gold" data-testid="go-dashboard-btn">Go to my learning</Link>
          {orderId && <Link to={`/orders/${orderId}`} className="btn-outline" data-testid="view-receipt-btn">View receipt</Link>}
        </div>
      </>)}
      {(state === "failed" || state === "timeout") && (<>
        <XCircle size={48} className="mx-auto text-red-500" />
        <h1 className="font-serif text-3xl mt-6">{state === "failed" ? "Payment didn't complete" : "Still processing"}</h1>
        <p className="text-slate-500 mt-3">{state === "failed" ? "No charge was made. You can try again." : "Check your dashboard in a minute; access is granted automatically when payment clears."}</p>
        <Link to="/dashboard" className="btn-outline mt-8">Open dashboard</Link>
      </>)}
    </div>
  );
}

export function PaymentCancel() {
  return (
    <div className="max-w-xl mx-auto px-6 py-28 text-center" data-testid="payment-cancel-page">
      <XCircle size={48} className="mx-auto text-slate-400" />
      <h1 className="font-serif text-3xl mt-6">Checkout cancelled</h1>
      <p className="text-slate-500 mt-3">Nothing was charged. Your cart is saved whenever you're ready.</p>
      <Link to="/cart" className="btn-gold mt-8">Return to cart</Link>
    </div>
  );
}
