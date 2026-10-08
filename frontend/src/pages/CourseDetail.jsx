import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Lock, PlayCircle, Clock, Users, ShoppingBag, Eye } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { Spinner } from "@/components/Shared";
import { PUBLIC_PRICING } from "@/lib/config";

export default function CourseDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const cart = useCart();
  const nav = useNavigate();
  const [course, setCourse] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/courses/${slug}`).then((r) => setCourse(r.data)).catch(() => setCourse(false));
  }, [slug, user]);

  if (course === null) return <Spinner />;
  if (course === false) return <div className="text-center py-32 font-serif text-2xl">Course not found.</div>;

  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);

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
    <div data-testid="course-detail-page">
      <section className="bg-[#0A192F] text-white relative overflow-hidden grain">
        <img src={course.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A192F] via-[#0A192F]/90 to-[#0A192F]/40" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8">
            <div className="flex gap-2 mb-5">
              <span className="navy-badge !border-amber-500/60">{course.level}</span>
              {course.topics.map((t) => <span key={t} className="gold-badge">{t}</span>)}
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl leading-tight tracking-tight" data-testid="course-title">{course.title}</h1>
            <p className="text-lg text-slate-300 mt-5 max-w-2xl">{course.subtitle}</p>
            <div className="flex flex-wrap gap-6 text-sm text-slate-300 mt-8">
              <span className="flex items-center gap-2"><PlayCircle size={16} className="text-amber-400" /> {totalLessons} lessons · {course.modules.length} modules</span>
              <span className="flex items-center gap-2"><Clock size={16} className="text-amber-400" /> {course.duration_hours} hours</span>
              <span className="flex items-center gap-2"><Users size={16} className="text-amber-400" /> {course.enrollment_count} enrolled</span>
            </div>
          </div>
          <div className="lg:col-span-4">
            <div className="bg-white text-[#0A192F] rounded-xl p-7 shadow-2xl lg:-mb-32 relative" data-testid="enroll-card">
              {PUBLIC_PRICING ? (
                <>
                  <div className="font-serif text-4xl" data-testid="course-price">{fmt(course.price)}</div>
                  <div className="text-xs text-slate-500 mt-1">One-time payment · lifetime access</div>
                </>
              ) : (
                <div className="font-serif text-2xl" data-testid="course-price">Enquire for pricing</div>
              )}
              {course.enrolled ? (
                <Link to={`/learn/${course.slug}`} className="btn-gold w-full mt-6" data-testid="continue-learning-btn">Continue learning</Link>
              ) : PUBLIC_PRICING ? (
                <>
                  <button onClick={enroll} disabled={busy} className="btn-gold w-full mt-6 disabled:opacity-60" data-testid="enroll-btn">{busy ? "Redirecting…" : "Enrol now"}</button>
                  <button onClick={addToCart} disabled={cart.has(course.id)} className="btn-outline w-full mt-3 disabled:opacity-50" data-testid="add-to-cart-btn">
                    <ShoppingBag size={15} /> {cart.has(course.id) ? "In cart" : "Add to cart"}
                  </button>
                </>
              ) : (
                <Link to={`/contact?subject=${encodeURIComponent(course.title)}`} className="btn-gold w-full mt-6" data-testid="course-enquire-btn">Enquire about this course</Link>
              )}
              <ul className="mt-6 space-y-2 text-sm text-slate-600">
                {["HD video lessons", "Downloadable PDFs & templates", "Progress tracking & resume", "Access on 2 devices"].map((x) => (
                  <li key={x} className="flex gap-2"><Check size={16} className="text-amber-600 shrink-0 mt-0.5" /> {x}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-14">
          <div>
            <div className="eyebrow mb-3">What you'll master</div>
            <ul className="grid sm:grid-cols-2 gap-3">
              {course.outcomes.map((o) => (
                <li key={o} className="flex gap-3 bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-700"><Check size={16} className="text-amber-600 shrink-0 mt-0.5" />{o}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">About this course</div>
            <div className="prose-lux" dangerouslySetInnerHTML={{ __html: course.description }} />
          </div>
          <div>
            <div className="eyebrow mb-3">Curriculum</div>
            <div className="space-y-4" data-testid="curriculum">
              {course.modules.map((m, mi) => (
                <div key={m.id} className="card-lux">
                  <div className="px-6 py-4 bg-stone-50 border-b border-slate-200 flex items-center justify-between">
                    <div><div className="text-xs text-slate-400 font-mono">MODULE {String(mi + 1).padStart(2, "0")}</div><h3 className="font-serif text-lg text-[#0A192F]">{m.title}</h3></div>
                    <span className="text-xs text-slate-500">{m.lessons.length} lessons</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {m.lessons.map((l) => (
                      <li key={l.id} className="px-6 py-3.5 flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          {l.locked ? <Lock size={14} className="text-slate-400 shrink-0" /> : <PlayCircle size={14} className="text-amber-600 shrink-0" />}
                          <span className={`truncate ${l.locked ? "text-slate-500" : "text-slate-800"}`}>{l.title}</span>
                          {l.is_preview && !course.enrolled && <span className="gold-badge !py-0.5 shrink-0"><Eye size={11} className="mr-1" /> Free preview</span>}
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-xs text-slate-400">{l.duration_minutes} min</span>
                          {!l.locked && <Link to={`/learn/${course.slug}?lesson=${l.id}`} className="text-xs font-medium text-amber-700 hover:underline" data-testid={`lesson-link-${l.id}`}>{course.enrolled ? "Open" : "Preview"}</Link>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
