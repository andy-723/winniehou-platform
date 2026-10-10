import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Save, Upload, FileText, Eye, Video } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { Spinner } from "@/components/Shared";
import { RichEditor } from "@/components/RichEditor";
import { AdminHeader } from "./AdminLayout";

const uid = () => crypto.randomUUID();
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

export default function CourseEditor() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(null);
  const [bunny, setBunny] = useState({ configured: false });

  useEffect(() => {
    api.get(`/admin/courses/${id}`).then((r) => setC(r.data)).catch(() => setC(false));
    api.get("/admin/bunny/status").then((r) => setBunny(r.data)).catch(() => {});
  }, [id]);

  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  const setModules = (fn) => setC((p) => ({ ...p, modules: fn(p.modules) }));

  const save = async (patch = {}) => {
    setSaving(true);
    try {
      const body = { ...c, ...patch, price: Number(c.price), duration_hours: Number(c.duration_hours) };
      const { data } = await api.put(`/admin/courses/${id}`, body);
      setC(data); toast.success(patch.published === true ? "Course published" : "Saved");
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };

  const uploadThumb = async (file) => {
    const fd = new FormData(); fd.append("file", file); fd.append("scope", "public");
    try { const { data } = await api.post("/admin/upload", fd); set("thumbnail_url", `${process.env.REACT_APP_BACKEND_URL}${data.url}`); toast.success("Thumbnail uploaded"); }
    catch (e) { toast.error(errMsg(e)); }
  };

  if (c === null) return <Spinner />;
  if (c === false) return <div className="text-slate-500">Course not found.</div>;

  return (
    <div data-testid="course-editor">
      <AdminHeader title={c.title || "Untitled course"} sub={<Link to="/admin/courses" className="hover:text-amber-700">← All courses</Link>}
        right={<div className="flex gap-2">
          <Link to={`/courses/${c.slug}`} target="_blank" className="btn-outline !py-2.5" data-testid="preview-course-btn"><Eye size={15} /> Preview</Link>
          <button onClick={() => save()} disabled={saving} className="btn-navy !py-2.5" data-testid="save-course-btn"><Save size={15} /> {saving ? "Saving…" : "Save"}</button>
          <button onClick={() => save({ published: !c.published })} disabled={saving} className={`${c.published ? "btn-outline" : "btn-gold"} !py-2.5`} data-testid="publish-toggle-btn">{c.published ? "Unpublish" : "Publish"}</button>
        </div>} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-5">
          <div className="card-lux p-6 space-y-4">
            <div className="eyebrow">Details</div>
            <div><label className="label-lux">Title</label><input className="input-lux" value={c.title} onChange={(e) => set("title", e.target.value)} data-testid="course-title-input" /></div>
            <div><label className="label-lux">Subtitle</label><input className="input-lux" value={c.subtitle} onChange={(e) => set("subtitle", e.target.value)} data-testid="course-subtitle-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-lux">Level</label><select className="input-lux" value={c.level} onChange={(e) => set("level", e.target.value)} data-testid="course-level-select">{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></div>
              <div><label className="label-lux">Price (cents)</label><input type="number" className="input-lux" value={c.price} onChange={(e) => set("price", e.target.value)} data-testid="course-price-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-lux">Duration (hours)</label><input type="number" step="0.5" className="input-lux" value={c.duration_hours} onChange={(e) => set("duration_hours", e.target.value)} /></div>
              <div><label className="label-lux">Topics (comma sep.)</label><input className="input-lux" value={c.topics.join(", ")} onChange={(e) => set("topics", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} data-testid="course-topics-input" /></div>
            </div>
            <div><label className="label-lux">Outcomes (one per line)</label><textarea className="input-lux" rows={4} value={(c.outcomes || []).join("\n")} onChange={(e) => set("outcomes", e.target.value.split("\n").filter(Boolean))} /></div>
            <div><label className="label-lux">Who this course is for (one per line)</label><textarea className="input-lux" rows={4} value={(c.audience || []).join("\n")} onChange={(e) => set("audience", e.target.value.split("\n").filter(Boolean))} data-testid="course-audience-input" /></div>
            <div>
              <label className="label-lux">Thumbnail</label>
              {c.thumbnail_url && <img src={c.thumbnail_url} alt="" className="w-full aspect-video object-cover rounded-lg mb-2" />}
              <div className="flex gap-2"><input className="input-lux" placeholder="https://…" value={c.thumbnail_url} onChange={(e) => set("thumbnail_url", e.target.value)} /><label className="btn-outline cursor-pointer shrink-0 !py-2"><Upload size={14} /><input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && uploadThumb(e.target.files[0])} data-testid="thumbnail-upload" /></label></div>
            </div>
          </div>
          <div className="card-lux p-6"><div className="eyebrow mb-3">Description</div><RichEditor value={c.description} onChange={(v) => set("description", v)} testId="course-description-editor" /></div>
        </div>

        <div className="xl:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <div className="eyebrow">Curriculum · {c.modules.length} modules</div>
            <button onClick={() => setModules((m) => [...m, { id: uid(), title: "New module", description: "", lessons: [] }])} className="btn-outline !py-2 !text-xs" data-testid="add-module-btn"><Plus size={14} /> Add module</button>
          </div>
          <div className="space-y-4">
            {c.modules.map((m, mi) => (
              <div key={m.id} className="card-lux" data-testid={`module-${m.id}`}>
                <div className="flex items-center gap-3 px-5 py-3 bg-stone-50 border-b border-slate-200">
                  <GripVertical size={16} className="text-slate-300" />
                  <span className="font-mono text-xs text-slate-400">{String(mi + 1).padStart(2, "0")}</span>
                  <input className="flex-1 bg-transparent font-serif text-lg text-[#0A192F] focus:outline-none" value={m.title} onChange={(e) => setModules((ms) => ms.map((x) => x.id === m.id ? { ...x, title: e.target.value } : x))} data-testid={`module-title-${m.id}`} />
                  <button onClick={() => setModules((ms) => ms.map((x) => x.id === m.id ? { ...x, lessons: [...x.lessons, { id: uid(), title: "New lesson", content: "", video_url: "", bunny_video_id: "", duration_minutes: 10, is_preview: false, attachments: [] }] } : x))} className="text-xs text-amber-700 font-medium hover:underline" data-testid={`add-lesson-${m.id}`}>+ Lesson</button>
                  <button onClick={() => window.confirm("Delete module and its lessons?") && setModules((ms) => ms.filter((x) => x.id !== m.id))} className="text-slate-400 hover:text-red-600 p-1" data-testid={`delete-module-${m.id}`}><Trash2 size={14} /></button>
                </div>
                <ul className="divide-y divide-slate-100">
                  {m.lessons.map((l) => (
                    <LessonRow key={l.id} lesson={l} courseId={c.id} open={open === l.id} toggle={() => setOpen(open === l.id ? null : l.id)} bunny={bunny}
                      update={(patch) => setModules((ms) => ms.map((x) => x.id === m.id ? { ...x, lessons: x.lessons.map((y) => y.id === l.id ? { ...y, ...patch } : y) } : x))}
                      remove={() => setModules((ms) => ms.map((x) => x.id === m.id ? { ...x, lessons: x.lessons.filter((y) => y.id !== l.id) } : x))} />
                  ))}
                  {m.lessons.length === 0 && <li className="px-5 py-4 text-xs text-slate-400 italic">No lessons yet.</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LessonRow({ lesson: l, courseId, open, toggle, update, remove, bunny }) {
  const [prog, setProg] = useState(null);

  const uploadVideo = async (file) => {
    const fd = new FormData(); fd.append("title", l.title); fd.append("file", file);
    setProg(0);
    try {
      const { data } = await api.post("/admin/videos", fd, { onUploadProgress: (e) => setProg(Math.round((e.loaded / e.total) * 100)) });
      update({ bunny_video_id: data.video_id }); toast.success("Video uploaded to Bunny Stream. Processing…");
    } catch (e) { toast.error(errMsg(e)); } finally { setProg(null); }
  };

  const uploadPdf = async (file) => {
    const fd = new FormData(); fd.append("file", file); fd.append("scope", "course"); fd.append("course_id", courseId);
    try { const { data } = await api.post("/admin/upload", fd); update({ attachments: [...(l.attachments || []), { file_id: data.id, name: file.name, size: data.size }] }); toast.success("Attachment added"); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <li data-testid={`lesson-${l.id}`}>
      <div className="flex items-center gap-3 px-5 py-3 text-sm">
        <button onClick={toggle} className="text-slate-400" data-testid={`toggle-lesson-${l.id}`}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
        <input className="flex-1 bg-transparent focus:outline-none" value={l.title} onChange={(e) => update({ title: e.target.value })} data-testid={`lesson-title-${l.id}`} />
        {(l.video_url || l.bunny_video_id) && <Video size={14} className="text-emerald-600" />}
        {l.attachments?.length > 0 && <span className="text-xs text-slate-400 flex items-center gap-1"><FileText size={12} />{l.attachments.length}</span>}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer"><input type="checkbox" checked={l.is_preview} onChange={(e) => update({ is_preview: e.target.checked })} className="accent-amber-500" data-testid={`preview-toggle-${l.id}`} /> Free preview</label>
        <button onClick={remove} className="text-slate-400 hover:text-red-600 p-1" data-testid={`delete-lesson-${l.id}`}><Trash2 size={14} /></button>
      </div>
      {open && (
        <div className="px-5 pb-6 pt-2 bg-stone-50/60 border-t border-slate-100 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label-lux">Video</label>
              {bunny.configured ? (
                <div className="space-y-2">
                  <label className="btn-outline cursor-pointer w-full !py-2 !text-xs"><Upload size={14} /> {l.bunny_video_id ? "Replace video on Bunny Stream" : "Upload to Bunny Stream"}<input type="file" accept="video/*" hidden onChange={(e) => e.target.files[0] && uploadVideo(e.target.files[0])} data-testid={`video-upload-${l.id}`} /></label>
                  {prog !== null && <div className="h-2 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-[width]" style={{ width: `${prog}%` }} /></div>}
                  {l.bunny_video_id && <div className="text-xs text-emerald-700 font-mono">Bunny ID: {l.bunny_video_id}</div>}
                </div>
              ) : (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">Bunny Stream not configured yet — add <code>BUNNY_LIBRARY_ID</code> and <code>BUNNY_STREAM_API_KEY</code> to enable direct uploads. Use a direct video URL meanwhile.</div>
              )}
              <input className="input-lux mt-2" placeholder="Or paste a direct MP4 / HLS URL" value={l.video_url} onChange={(e) => update({ video_url: e.target.value })} data-testid={`video-url-${l.id}`} />
            </div>
            <div>
              <label className="label-lux">Duration (minutes)</label>
              <input type="number" className="input-lux" value={l.duration_minutes} onChange={(e) => update({ duration_minutes: Number(e.target.value) })} />
              <label className="label-lux mt-4">PDF attachments</label>
              <ul className="space-y-1 mb-2">{(l.attachments || []).map((a) => <li key={a.file_id} className="flex items-center gap-2 text-xs bg-white border rounded px-2 py-1.5"><FileText size={12} className="text-amber-600" /><span className="flex-1 truncate">{a.name}</span><button onClick={() => update({ attachments: l.attachments.filter((x) => x.file_id !== a.file_id) })} className="text-slate-400 hover:text-red-600">×</button></li>)}</ul>
              <label className="btn-outline cursor-pointer w-full !py-2 !text-xs"><Upload size={14} /> Attach PDF<input type="file" accept=".pdf,application/pdf" hidden onChange={(e) => e.target.files[0] && uploadPdf(e.target.files[0])} data-testid={`pdf-upload-${l.id}`} /></label>
            </div>
          </div>
          <div><label className="label-lux">Lesson notes</label><RichEditor value={l.content} onChange={(v) => update({ content: v })} testId={`lesson-content-${l.id}`} /></div>
        </div>
      )}
    </li>
  );
}
