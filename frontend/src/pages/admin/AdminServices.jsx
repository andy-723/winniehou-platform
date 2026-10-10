import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { api, errMsg, fmtDate } from "@/lib/api";
import { servicePrice } from "@/lib/config";
import { Spinner } from "@/components/Shared";
import { AdminHeader, Table, Modal } from "./AdminLayout";

const blank = { key: "", name: "", tagline: "", description: "", inclusions: "", situation_quote: "", for_you_if: "", outcomes_intro: "", duration_label: "", price_cents: 0, gst_treatment: "ex_gst", sort_order: 0, status: "draft", cta_type: "enquire" };

export default function AdminServices() {
  const [tab, setTab] = useState("packages");
  const [pkgs, setPkgs] = useState(null);
  const [enq, setEnq] = useState(null);
  const [wl, setWl] = useState(null);
  const [leads, setLeads] = useState(null);
  const [edit, setEdit] = useState(null);

  const loadPkgs = () => api.get("/admin/services").then((r) => setPkgs(r.data));
  const loadEnq = () => api.get("/admin/service-enquiries").then((r) => setEnq(r.data));
  const loadWl = () => api.get("/admin/waitlist").then((r) => setWl(r.data));
  const loadLeads = () => api.get("/admin/lead-visits").then((r) => setLeads(r.data));
  useEffect(() => { loadPkgs(); loadEnq(); loadWl(); loadLeads(); }, []);

  const save = async () => {
    try {
      const body = {
        ...edit,
        inclusions: typeof edit.inclusions === "string" ? edit.inclusions.split("\n").map((s) => s.trim()).filter(Boolean) : edit.inclusions,
        for_you_if: typeof edit.for_you_if === "string" ? edit.for_you_if.split("\n").map((s) => s.trim()).filter(Boolean) : (edit.for_you_if || []),
        price_cents: Number(edit.price_cents) || 0,
        sort_order: Number(edit.sort_order) || 0,
      };
      if (edit.id) await api.put(`/admin/services/${edit.id}`, body);
      else await api.post("/admin/services", body);
      toast.success("Saved"); setEdit(null); loadPkgs();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (id) => { if (!window.confirm("Delete this package?")) return; await api.delete(`/admin/services/${id}`); toast.success("Deleted"); loadPkgs(); };
  const markContacted = async (e) => { await api.patch(`/admin/service-enquiries/${e.id}?contacted=${!e.contacted}`); loadEnq(); };

  if (!pkgs || !enq || !wl || !leads) return <Spinner />;
  const Tab = ({ id, label, n }) => <button onClick={() => setTab(id)} data-testid={`services-tab-${id}`} className={`px-4 py-2 text-sm rounded-lg transition-colors ${tab === id ? "bg-[#0A192F] text-amber-300" : "text-slate-600 hover:bg-stone-100"}`}>{label}{n != null && ` (${n})`}</button>;

  return (
    <div data-testid="admin-services">
      <AdminHeader title="Services" sub="Coaching packages, enquiries and the 1-on-1 waitlist" right={tab === "packages" && <button onClick={() => setEdit({ ...blank })} className="btn-navy !py-2 !text-sm" data-testid="add-package-btn"><Plus size={15} /> New package</button>} />
      <div className="flex gap-2 mb-6"><Tab id="packages" label="Packages" n={pkgs.length} /><Tab id="enquiries" label="Enquiries" n={enq.length} /><Tab id="waitlist" label="1-on-1 waitlist" n={wl.length} /><Tab id="leads" label="Lead visits" n={leads.length} /></div>

      {tab === "packages" && <Table cols={["Name", "Price", "GST", "CTA", "Status", "Order", ""]} rows={pkgs} testId="packages-table" render={(p) => (
        <tr key={p.id} data-testid={`package-row-${p.key}`}>
          <td className="px-4 py-3"><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">{p.tagline}</div></td>
          <td className="px-4 py-3">{servicePrice(p).main}</td>
          <td className="px-4 py-3">{p.gst_treatment}</td>
          <td className="px-4 py-3">{p.cta_type}</td>
          <td className="px-4 py-3"><span className="gold-badge">{p.status}</span></td>
          <td className="px-4 py-3">{p.sort_order}</td>
          <td className="px-4 py-3 text-right whitespace-nowrap"><button onClick={() => setEdit({ ...p, inclusions: (p.inclusions || []).join("\n"), for_you_if: (p.for_you_if || []).join("\n") })} className="text-amber-700 mr-3" data-testid={`edit-package-${p.key}`}><Pencil size={15} /></button><button onClick={() => del(p.id)} className="text-red-600" data-testid={`delete-package-${p.key}`}><Trash2 size={15} /></button></td>
        </tr>
      )} />}

      {tab === "enquiries" && <Table cols={["Date", "Name", "Email", "Package", "Message", "Status"]} rows={enq} testId="enquiries-table" render={(e) => (
        <tr key={e.id} data-testid={`enquiry-row-${e.id}`}>
          <td className="px-4 py-3 text-slate-500">{fmtDate(e.created_at)}</td>
          <td className="px-4 py-3">{e.name}</td>
          <td className="px-4 py-3">{e.email}</td>
          <td className="px-4 py-3">{e.package || "—"}</td>
          <td className="px-4 py-3 max-w-xs truncate">{e.message}</td>
          <td className="px-4 py-3"><button onClick={() => markContacted(e)} className={`gold-badge ${e.contacted ? "!bg-emerald-50 !text-emerald-700 !border-emerald-200" : ""}`} data-testid={`enquiry-contacted-${e.id}`}>{e.contacted ? "Contacted" : "Mark contacted"}</button></td>
        </tr>
      )} />}

      {tab === "waitlist" && <Table cols={["Date", "Name", "Email", "Source"]} rows={wl} testId="waitlist-table" render={(w) => (
        <tr key={w.id} data-testid={`waitlist-row-${w.id}`}><td className="px-4 py-3 text-slate-500">{fmtDate(w.created_at)}</td><td className="px-4 py-3">{w.name}</td><td className="px-4 py-3">{w.email}</td><td className="px-4 py-3">{w.source}</td></tr>
      )} />}

      {tab === "leads" && <Table cols={["Date", "Name", "Lead ID"]} rows={leads} testId="leads-table" render={(l) => (
        <tr key={l.id} data-testid={`lead-row-${l.id}`}><td className="px-4 py-3 text-slate-500">{fmtDate(l.created_at)}</td><td className="px-4 py-3">{l.name || "—"}</td><td className="px-4 py-3 font-mono text-xs">{l.lead}</td></tr>
      )} />}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit package" : "New package"} wide>
        {edit && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <label className="block">Name<input className="input-lux mt-1" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-testid="pkg-name" /></label>
              <label className="block">Key (slug)<input className="input-lux mt-1" value={edit.key} onChange={(e) => setEdit({ ...edit, key: e.target.value })} data-testid="pkg-key" /></label>
            </div>
            <label className="block">Tagline<input className="input-lux mt-1" value={edit.tagline} onChange={(e) => setEdit({ ...edit, tagline: e.target.value })} data-testid="pkg-tagline" /></label>
            <label className="block">Situation quote<input className="input-lux mt-1" value={edit.situation_quote || ""} onChange={(e) => setEdit({ ...edit, situation_quote: e.target.value })} data-testid="pkg-situation" /></label>
            <label className="block">Description<textarea rows={3} className="input-lux mt-1" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} data-testid="pkg-description" /></label>
            <label className="block">This is for you if (one per line)<textarea rows={3} className="input-lux mt-1" value={edit.for_you_if || ""} onChange={(e) => setEdit({ ...edit, for_you_if: e.target.value })} data-testid="pkg-for-you" /></label>
            <label className="block">What we work on (one per line)<textarea rows={4} className="input-lux mt-1" value={edit.inclusions} onChange={(e) => setEdit({ ...edit, inclusions: e.target.value })} data-testid="pkg-inclusions" /></label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">Price (cents, AUD)<input type="number" className="input-lux mt-1" value={edit.price_cents} onChange={(e) => setEdit({ ...edit, price_cents: e.target.value })} data-testid="pkg-price" /></label>
              <label className="block">GST<select className="input-lux mt-1" value={edit.gst_treatment} onChange={(e) => setEdit({ ...edit, gst_treatment: e.target.value })} data-testid="pkg-gst"><option value="ex_gst">ex GST</option><option value="inc_gst">inc GST</option></select></label>
              <label className="block">CTA type<select className="input-lux mt-1" value={edit.cta_type} onChange={(e) => setEdit({ ...edit, cta_type: e.target.value })} data-testid="pkg-cta"><option value="enquire">Enquire</option><option value="book_call">Book a call</option></select></label>
              <label className="block">Duration label<input className="input-lux mt-1" value={edit.duration_label} onChange={(e) => setEdit({ ...edit, duration_label: e.target.value })} data-testid="pkg-duration" /></label>
              <label className="block">Sort order<input type="number" className="input-lux mt-1" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} data-testid="pkg-sort" /></label>
              <label className="block">Status<select className="input-lux mt-1" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} data-testid="pkg-status"><option value="draft">Draft</option><option value="published">Published</option></select></label>
            </div>
            <button onClick={save} className="btn-gold w-full" data-testid="pkg-save">Save package</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
