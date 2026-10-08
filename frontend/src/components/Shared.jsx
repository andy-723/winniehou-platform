import { useRef } from "react";
import { Link } from "react-router-dom";
import { Clock, PlayCircle, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

export const CourseCard = ({ course, delay = 0 }) => (
  <Link to={`/courses/${course.slug}`} data-testid={`course-card-${course.slug}`}
    className="group flex flex-col rounded-xl overflow-hidden bg-[#0F213D] border border-[#D4AF37]/15 hover:border-[#D4AF37]/60 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(212,175,55,0.15)] transition-[transform,border-color,box-shadow] duration-300 rise"
    style={{ animationDelay: `${delay}ms` }}>
    <div className="relative aspect-[16/10] overflow-hidden bg-[#050E1E]">
      <img src={course.thumbnail_url} alt={course.title}
        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-[transform,opacity] duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050E1E] via-[#050E1E]/25 to-transparent" />
      <span className="absolute top-3 left-3 navy-badge !bg-[#050E1E]/80">{course.level}</span>
      <span className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-amber-200/90 bg-[#050E1E]/70 px-2 py-1 rounded-md backdrop-blur-sm"><PlayCircle size={12} /> {course.lesson_count} lessons</span>
    </div>
    <div className="p-5 flex flex-col flex-1">
      <div className="flex flex-wrap gap-2 mb-2">
        {(course.topics || []).slice(0, 2).map((t) => <span key={t} className="text-[10px] font-mono uppercase tracking-[0.15em] text-amber-400/80">{t}</span>)}
      </div>
      <h3 className="font-serif text-lg text-[#F9F8F3] leading-snug group-hover:text-amber-300 transition-colors">{course.title}</h3>
      <p className="text-sm text-slate-400 mt-2 line-clamp-2 flex-1">{course.subtitle}</p>
      <div className="flex items-center justify-between text-xs text-slate-500 mt-4 pt-3 border-t border-white/5">
        <span className="flex items-center gap-1.5"><Clock size={13} /> {course.duration_hours}h</span>
        <span className="text-amber-400 font-medium inline-flex items-center gap-1 group-hover:gap-2 transition-[gap] duration-200">Enquire <ArrowRight size={13} /></span>
      </div>
    </div>
  </Link>
);

export const ContentRow = ({ title, eyebrow, to, children, testId = "content-row" }) => {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="py-12 border-b border-[#D4AF37]/10" data-testid={testId}>
      <div className="max-w-7xl mx-auto px-6 flex items-end justify-between mb-6">
        <div>
          {eyebrow && <div className="eyebrow-dark mb-2">{eyebrow}</div>}
          <h2 className="font-serif text-2xl sm:text-3xl text-[#F9F8F3]">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {to && <Link to={to} className="text-sm font-medium text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 whitespace-nowrap" data-testid={`${testId}-explore`}>Explore all <ArrowRight size={14} /></Link>}
          <div className="hidden sm:flex gap-2">
            <button onClick={() => scroll(-1)} className="w-9 h-9 rounded-full border border-white/15 text-slate-300 hover:border-amber-400 hover:text-amber-300 flex items-center justify-center transition-colors" data-testid={`${testId}-prev`} aria-label="Scroll left"><ChevronLeft size={16} /></button>
            <button onClick={() => scroll(1)} className="w-9 h-9 rounded-full border border-white/15 text-slate-300 hover:border-amber-400 hover:text-amber-300 flex items-center justify-center transition-colors" data-testid={`${testId}-next`} aria-label="Scroll right"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
      <div ref={ref} className="max-w-7xl mx-auto px-6 flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-2">
        {children}
      </div>
    </section>
  );
};

export const MembershipBand = () => (
  <section className="py-16 px-6" data-testid="membership-band">
    <div className="max-w-5xl mx-auto rounded-2xl bg-gradient-to-r from-[#050E1E] via-[#0F213D] to-[#050E1E] border border-[#D4AF37]/40 p-10 sm:p-16 text-center relative overflow-hidden shadow-2xl">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 0%, rgba(212,175,55,0.22), transparent 60%)", animation: "shimmer 6s ease-in-out infinite" }} />
      <div className="relative">
        <div className="eyebrow-dark mb-4">Work with Winnie</div>
        <h2 className="font-serif text-3xl sm:text-4xl text-[#F9F8F3] max-w-2xl mx-auto leading-tight">Step behind the velvet rope of C-suite communication.</h2>
        <p className="text-slate-300 mt-5 max-w-xl mx-auto">Personalised coaching for career growth, interviews and executive presence.</p>
        <div className="flex flex-wrap gap-4 justify-center mt-8">
          <Link to="/services" className="btn-gold" data-testid="membership-services-cta">Explore coaching <ArrowRight size={16} /></Link>
          <Link to="/courses" className="btn-gold-outline" data-testid="membership-courses-cta">Browse masterclasses</Link>
        </div>
      </div>
    </div>
  </section>
);

export const Spinner = ({ label = "Loading" }) => (
  <div className="flex items-center justify-center py-24 text-slate-400 text-sm" data-testid="loading-spinner">
    <span className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-3" />{label}…
  </div>
);

export const Empty = ({ title, hint, cta }) => (
  <div className="text-center py-20 border border-dashed border-slate-300 rounded-xl bg-white/50" data-testid="empty-state">
    <h3 className="font-serif text-2xl text-[#0A192F]">{title}</h3>
    {hint && <p className="text-slate-500 text-sm mt-2">{hint}</p>}
    {cta && <div className="mt-6">{cta}</div>}
  </div>
);

export const PageHeader = ({ eyebrow, title, sub, right }) => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
    <div>
      {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
      <h1 className="font-serif text-4xl sm:text-5xl text-[#0A192F] tracking-tight">{title}</h1>
      {sub && <p className="text-base md:text-lg text-slate-500 mt-3 max-w-2xl">{sub}</p>}
    </div>
    {right}
  </div>
);
