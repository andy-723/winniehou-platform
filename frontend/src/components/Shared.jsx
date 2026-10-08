import { Link } from "react-router-dom";
import { Clock, PlayCircle } from "lucide-react";
import { fmt } from "@/lib/api";

export const CourseCard = ({ course, delay = 0 }) => (
  <Link to={`/courses/${course.slug}`} data-testid={`course-card-${course.slug}`}
    className="card-lux group flex flex-col rise" style={{ animationDelay: `${delay}ms` }}>
    <div className="relative aspect-[16/10] overflow-hidden bg-[#0A192F]">
      <img src={course.thumbnail_url} alt={course.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F]/80 via-transparent to-transparent" />
      <span className="absolute top-3 left-3 navy-badge">{course.level}</span>
      <span className="absolute bottom-3 right-3 font-serif text-2xl text-amber-300">{fmt(course.price)}</span>
    </div>
    <div className="p-6 flex flex-col flex-1">
      <div className="flex flex-wrap gap-2 mb-3">
        {(course.topics || []).slice(0, 2).map((t) => <span key={t} className="gold-badge">{t}</span>)}
      </div>
      <h3 className="font-serif text-xl text-[#0A192F] leading-snug group-hover:text-amber-700 transition-colors">{course.title}</h3>
      <p className="text-sm text-slate-500 mt-2 line-clamp-2 flex-1">{course.subtitle}</p>
      <div className="flex items-center gap-4 text-xs text-slate-500 mt-5 pt-4 border-t border-slate-100">
        <span className="flex items-center gap-1.5"><PlayCircle size={14} /> {course.lesson_count} lessons</span>
        <span className="flex items-center gap-1.5"><Clock size={14} /> {course.duration_hours}h</span>
      </div>
    </div>
  </Link>
);

export const Spinner = ({ label = "Loading" }) => (
  <div className="flex items-center justify-center py-24 text-slate-500 text-sm" data-testid="loading-spinner">
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
