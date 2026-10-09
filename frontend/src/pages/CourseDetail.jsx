import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, Clock, Eye, Lock, PlayCircle, ShoppingBag, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { Spinner } from "@/components/Shared";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ShortDisclaimer } from "@/pages/Legal";
import { PUBLIC_PRICING } from "@/lib/config";

function durationLabel(hours) {
  const n = Number(hours);
  if (!n) return null;
  return Number.isInteger(n) ? `${n} hours` : `${n} hours`;
}

export default function CourseDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const cart = useCart();
  const nav = useNavigate();
  const [course, setCourse] = useState(null);
  const [preview, setPreview] = useState(null);
  const [openModule, setOpenModule] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCourse(null);
    setPreview(null);
    api.get(`/courses/${slug}`).then((r) => {
      setCourse(r.data);
      const first = r.data.modules?.[0]?.id;
      setOpenModule(first || null);
    }).catch(() => setCourse(false));
  }, [slug, user]);

  useEffect(() => {
    if (!course || course === false) return;
    const lesson = course.modules.flatMap((m) => m.lessons).find((l) => !l.locked && l.has_video);
    if (!lesson) return;
    api.get(`/courses/${slug}/lessons/${lesson.id}`).then((r) => setPreview(r.data)).catch(() => setPreview(null));
  }, [course, slug]);

  if (course === null) return <Spinner />;
  if (course === false) return <div className="text-center py-32 font-serif text-2xl">Course not found.</div>;

  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);
  const previewCount = course.modules.reduce((s, m) => s + m.lessons.filter((l) => l.is_preview).length, 0);
  const hours = durationLabel(course.duration_hours);
  const audience = course.audience || [];

  const enroll = async () => {
    if (!user) { nav(`/login?next=/courses/${slug}`); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/payments/checkout", {
        items: [{ type: "course", id: course.id }], origin_url: window.location.origin,
      });
      window.location.href = data.checkout_url;
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };

  const addToCart = () => {
    cart.add({ type: "course", id: course.id, title: course.title, price: course.price, image: course.thumbnail_url, slug: course.slug });
    toast.success("Added to cart");
  };

  return (
    <div className="bg-[#F9F8F3] min-h-screen" data-testid="course-detail-page">
      <section className="bg-[#0A192F] text-white">
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-28 lg:pb-36">
          <nav className="text-xs text-slate-400 mb-6 flex flex-wrap gap-2" data-testid="course-breadcrumb">
            <Link to="/courses" className="hover:text-amber-300">Courses</Link>
            {course.topics?.[0] && <span>/ {course.topics[0]}</span>}
          </nav>
          <div className="lg:max-w-[62%]">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="navy-badge !border-amber-500/60">{course.level}</span>
              {course.topics.map((t) => <span key={t} className="gold-badge">{t}</span>)}
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl leading-tight tracking-tight" data-testid="course-title">{course.title}</h1>
            <p className="text-lg text-slate-300 mt-4 max-w-2xl" data-testid="course-subtitle">{course.subtitle}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300 mt-6">
              {hours && <span className="flex items-center gap-2" data-testid="course-duration"><Clock size={16} className="text-amber-400" /> {hours}</span>}
              <span className="flex items-center gap-2"><PlayCircle size={16} className="text-amber-400" /> {totalLessons} lessons · {course.modules.length} modules</span>
              <span>Created by Winnie Hou</span>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 order-2 lg:order-1 py-12 space-y-14">
          {course.outcomes?.length > 0 && (
            <section data-testid="course-outcomes">
              <h2 className="font-serif text-2xl text-[#0A192F] mb-4">What you'll learn</h2>
              <ul className="grid sm:grid-cols-2 gap-3 border border-slate-200 rounded-xl p-5 bg-white">
                {course.outcomes.map((o) => (
                  <li key={o} className="flex gap-3 text-sm text-slate-700"><Check size={16} className="text-amber-600 shrink-0 mt-0.5" />{o}</li>
                ))}
              </ul>
            </section>
          )}

          <section data-testid="curriculum">
            <div className="flex items-end justify-between gap-4 mb-4">
              <h2 className="font-serif text-2xl text-[#0A192F]">Course content</h2>
              <p className="text-sm text-slate-500">{course.modules.length} modules · {totalLessons} lessons{hours ? ` · ${hours}` : ""}</p>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white divide-y divide-slate-200">
              {course.modules.map((m, mi) => {
                const open = openModule === m.id;
                const mins = m.lessons.reduce((s, l) => s + (Number(l.duration_minutes) || 0), 0);
                return (
                  <div key={m.id}>
                    <button type="button" onClick={() => setOpenModule(open ? null : m.id)}
                      className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-stone-50" data-testid={`module-toggle-${m.id}`}>
                      <ChevronDown size={18} className={`text-slate-500 mt-1 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono text-slate-400">Section {mi + 1}</div>
                        <h3 className="font-serif text-lg text-[#0A192F]">{m.title}</h3>
                        {m.description && <p className="text-sm text-slate-500 mt-1">{m.description}</p>}
                      </div>
                      <span className="text-xs text-slate-500 shrink-0 pt-1">{m.lessons.length} lessons{mins ? ` · ${mins} min` : ""}</span>
                    </button>
                    {open && (
                      <ul className="border-t border-slate-100">
                        {m.lessons.map((l) => (
                          <li key={l.id} className="px-5 py-3 pl-14 flex items-center justify-between gap-4 text-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              {l.locked ? <Lock size={14} className="text-slate-400 shrink-0" /> : <PlayCircle size={14} className="text-amber-600 shrink-0" />}
                              <span className={`truncate ${l.locked ? "text-slate-400" : "text-slate-800"}`}>{l.title}</span>
                              {l.is_preview && !course.enrolled && <span className="gold-badge !py-0.5 shrink-0"><Eye size={11} className="mr-1" /> Preview</span>}
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <span className="text-xs text-slate-500">{l.duration_minutes} min</span>
                              {!l.locked && <Link to={`/learn/${course.slug}?lesson=${l.id}`} className="text-xs font-medium text-amber-700 hover:underline" data-testid={`lesson-link-${l.id}`}>{course.enrolled ? "Open" : "Preview"}</Link>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section data-testid="course-description">
            <h2 className="font-serif text-2xl text-[#0A192F] mb-4">Description</h2>
            <div className="prose-lux" dangerouslySetInnerHTML={{ __html: course.description }} />
          </section>

          {audience.length > 0 && (
            <section data-testid="course-audience">
              <h2 className="font-serif text-2xl text-[#0A192F] mb-4">Who this course is for</h2>
              <ul className="space-y-3">
                {audience.map((line) => (
                  <li key={line} className="flex gap-3 text-sm text-slate-700">
                    <UserRound size={16} className="text-amber-700 shrink-0 mt-0.5" />
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="lg:col-span-4 order-1 lg:order-2 -mt-20 lg:-mt-44" data-testid="enroll-card">
          <div className="lg:sticky lg:top-6 bg-white text-[#0A192F] rounded-xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-black" data-testid="course-preview">
              {preview?.video ? (
                <VideoPlayer video={preview.video} watermark={preview.watermark} />
              ) : (
                <div className="relative aspect-video">
                  {course.thumbnail_url && <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-[#0A192F]/40" />
                </div>
              )}
            </div>
            <div className="px-5 pt-4 text-sm font-semibold">Preview this course{preview?.title ? `: ${preview.title}` : ""}</div>
            <div className="px-5 pb-6 pt-3">
              {PUBLIC_PRICING ? (
                <>
                  <div className="font-serif text-4xl" data-testid="course-price">{fmt(course.price)}</div>
                  <div className="text-xs text-slate-500 mt-1">One-time payment · lifetime access</div>
                </>
              ) : (
                <div className="font-serif text-2xl" data-testid="course-price">Enquire for pricing</div>
              )}
              {course.enrolled ? (
                <Link to={`/learn/${course.slug}`} className="btn-gold w-full mt-5" data-testid="continue-learning-btn">Continue learning</Link>
              ) : PUBLIC_PRICING ? (
                <>
                  <button onClick={enroll} disabled={busy} className="btn-gold w-full mt-5 disabled:opacity-60" data-testid="enroll-btn">{busy ? "Redirecting…" : "Enrol now"}</button>
                  <button onClick={addToCart} disabled={cart.has(course.id)} className="btn-outline w-full mt-3 disabled:opacity-50" data-testid="add-to-cart-btn">
                    <ShoppingBag size={15} /> {cart.has(course.id) ? "In cart" : "Add to cart"}
                  </button>
                </>
              ) : (
                <Link to={`/contact?subject=${encodeURIComponent(course.title)}`} className="btn-gold w-full mt-5" data-testid="course-enquire-btn">Enquire about this course</Link>
              )}
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-6 mb-3">This course includes</p>
              <ul className="space-y-2 text-sm text-slate-600">
                {hours && <li className="flex gap-2"><Clock size={16} className="text-amber-600 shrink-0 mt-0.5" /> {hours} of lessons</li>}
                <li className="flex gap-2"><PlayCircle size={16} className="text-amber-600 shrink-0 mt-0.5" /> {totalLessons} lessons across {course.modules.length} sections</li>
                {previewCount > 0 && <li className="flex gap-2"><Eye size={16} className="text-amber-600 shrink-0 mt-0.5" /> {previewCount} free preview {previewCount === 1 ? "lesson" : "lessons"}</li>}
                <li className="flex gap-2"><Check size={16} className="text-amber-600 shrink-0 mt-0.5" /> Progress saved, so you can resume</li>
              </ul>
              <ShortDisclaimer className="mt-5 pt-4 border-t border-slate-200" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
