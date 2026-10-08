import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { PageHeader } from "@/components/Shared";

export default function Contact() {
  const [sp] = useSearchParams();
  const subject = sp.get("subject");
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: subject ? `I'm interested in ${subject}.` : "", consent: false });
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.consent) { toast.error("Please agree to be contacted."); return; }
    try { await api.post("/service-enquiries", { ...form, type: "contact", package: "general" }); setSent(true); toast.success("Message sent"); }
    catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-16" data-testid="contact-page">
      <PageHeader eyebrow="Contact" title="Get in touch" sub="Questions about courses or coaching? Send a message and we'll reply soon." />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 card-lux p-8">
          {sent ? (
            <div className="text-emerald-700" data-testid="contact-success">Thank you — your message has been sent.</div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <input className="input-lux" placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="contact-name" />
              <input className="input-lux" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="contact-email" />
              <input className="input-lux" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="contact-phone" />
              <textarea className="input-lux" rows={5} placeholder="Your message" required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} data-testid="contact-message" />
              <label className="flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1" data-testid="contact-consent" /> I agree to be contacted about my enquiry.</label>
              <button className="btn-gold w-full" data-testid="contact-submit">Send message</button>
            </form>
          )}
        </div>
        <div className="lg:col-span-5">
          <div className="card-lux p-8 text-center">
            <div className="eyebrow mb-4">WeChat</div>
            <div className="aspect-square max-w-[220px] mx-auto rounded-xl bg-stone-100 flex items-center justify-center text-slate-400 text-sm" data-testid="wechat-qr-slot">[WECHAT QR TO COME]</div>
            <p className="text-sm text-slate-500 mt-4">Scan to connect with Winnie on WeChat.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
