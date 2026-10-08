import { useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { CourseCard, Spinner, Empty, MembershipBand } from "@/components/Shared";

export default function Catalog() {
  const [courses, setCourses] = useState(null);
  const [filters, setFilters] = useState({ levels: [], topics: [] });
  const [f, setF] = useState({ level: "", topic: "", q: "" });

  useEffect(() => { api.get("/courses/filters").then((r) => setFilters(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    setCourses(null);
    api.get("/courses", { params }).then((r) => setCourses(r.data)).catch(() => setCourses([]));
  }, [f]);

  const Chip = ({ active, onClick, children, testId }) => (
    <button onClick={onClick} data-testid={testId}
      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${active ? "bg-amber-500 text-[#0A192F] border-amber-500" : "bg-transparent text-slate-300 border-white/15 hover:border-amber-400 hover:text-amber-300"}`}>{children}</button>
  );

  return (
    <div className="bg-[#0A192F] min-h-screen" data-testid="catalog-page">
      <section className="border-b border-[#D4AF37]/10 bg-[#050E1E]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="eyebrow-dark mb-3">Course catalog</div>
              <h1 className="font-serif text-4xl sm:text-5xl text-[#F9F8F3] tracking-tight">Every course, one standard.</h1>
              <p className="text-base md:text-lg text-slate-400 mt-3 max-w-2xl">Choose by level or topic. Each course includes free preview lessons so you can judge the teaching before you enrol.</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search courses…"
                className="w-full rounded-lg border border-white/15 bg-[#0A192F] pl-9 pr-3 py-2.5 text-sm text-[#F9F8F3] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-[box-shadow,border-color]" data-testid="catalog-search" />
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col gap-4 mb-10">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider"><SlidersHorizontal size={14} /> Filters</div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500 w-14">Level</span>
            <Chip active={!f.level} onClick={() => setF({ ...f, level: "" })} testId="filter-level-all">All</Chip>
            {filters.levels.map((l) => <Chip key={l} active={f.level === l} onClick={() => setF({ ...f, level: l })} testId={`filter-level-${l.toLowerCase()}`}>{l}</Chip>)}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500 w-14">Topic</span>
            <Chip active={!f.topic} onClick={() => setF({ ...f, topic: "" })} testId="filter-topic-all">All</Chip>
            {filters.topics.map((t) => <Chip key={t} active={f.topic === t} onClick={() => setF({ ...f, topic: t })} testId={`filter-topic-${t.toLowerCase()}`}>{t}</Chip>)}
          </div>
        </div>

        {courses === null ? <Spinner /> : courses.length === 0 ? (
          <Empty title="No courses match" hint="Try clearing a filter or two." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="catalog-grid">
            {courses.map((c, i) => <CourseCard key={c.id} course={c} delay={i * 70} />)}
          </div>
        )}
      </div>

      <MembershipBand />
    </div>
  );
}
