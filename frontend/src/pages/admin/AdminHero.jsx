import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { AdminHeader } from "./AdminLayout";

const SLOTS = [
  ["portrait", "Portrait (desktop)"],
  ["portrait_mobile", "Portrait (mobile crop)"],
  ["side_left", "Side image, left"],
  ["side_right", "Side image, right"],
];

const blank = { portrait: { url: "", alt: "" }, portrait_mobile: { url: "", alt: "" }, side_left: { url: "", alt: "" }, side_right: { url: "", alt: "" } };

function Slot({ label, value, onChange, testId }) {
  const upload = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("scope", "public");
    try {
      const { data } = await api.post("/admin/upload", fd);
      onChange({ ...value, url: data.url });
      toast.success("Image uploaded");
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="card-lux p-5" data-testid={testId}>
      <div className="label-lux">{label}</div>
      {value.url ? (
        <img src={value.url} alt="" className="h-40 w-full object-contain bg-[#0A192F] mb-3" />
      ) : (
        <div className="h-40 bg-[#0A192F] text-[#D4AF37]/80 text-xs tracking-widest uppercase flex items-center justify-center mb-3">Portrait coming soon</div>
      )}
      <div className="flex gap-2 mb-3">
        <label className="btn-outline cursor-pointer !py-2">
          <Upload size={14} /> Upload
          <input type="file" accept="image/webp,image/png,image/jpeg,image/svg+xml" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} data-testid={`${testId}-file`} />
        </label>
        {value.url && <button type="button" className="btn-outline !py-2" onClick={() => onChange({ ...value, url: "" })}>Remove</button>}
      </div>
      <label className="block text-xs text-slate-500">Alt text
        <input className="input-lux mt-1" value={value.alt || ""} onChange={(e) => onChange({ ...value, alt: e.target.value })} data-testid={`${testId}-alt`} />
      </label>
    </div>
  );
}

export default function AdminHero() {
  const [hero, setHero] = useState(null);
  useEffect(() => { api.get("/admin/homepage-hero").then((r) => setHero({ ...blank, ...r.data })).catch((e) => toast.error(errMsg(e))); }, []);
  const save = async () => {
    try { await api.put("/admin/homepage-hero", hero); toast.success("Homepage hero saved"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  if (!hero) return null;
  return (
    <div data-testid="admin-hero">
      <AdminHeader title="Homepage hero" sub="Portrait and the two side frames. Until a photo is uploaded, the public page shows a navy placeholder." right={<button className="btn-navy" onClick={save} data-testid="hero-save">Save</button>} />
      <div className="grid md:grid-cols-2 gap-5">
        {SLOTS.map(([key, label]) => (
          <Slot key={key} label={label} value={hero[key] || { url: "", alt: "" }} onChange={(next) => setHero({ ...hero, [key]: next })} testId={`hero-slot-${key}`} />
        ))}
      </div>
    </div>
  );
}
