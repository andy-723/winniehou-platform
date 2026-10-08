import { useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { CourseCard, Spinner, Empty, PageHeader } from "@/components/Shared";

const priceBands = [
  { label: "Any price", value: "" }, { label: "Under $100", value: "9999" },
  { label: "Under $150", value: "14999" }, { label: "Under $250", value: "24999" },
];

export default function Catalog() {
  const [courses, setCourses] = useState(null);
  const [filters, setFilters] = useState({ levels: [], topics: [] });
  const [f, setF] = useState({ level: "", topic: "", max_price: "", q: "" });

  useEffect(() => { api.get("/courses/filters").then((r) => setFilters(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    setCourses(null);
    api.get("/courses", { params }).then((r) => setCourses(r.data)).catch(() => setCourses([]));
  }, [f]);

  const Chip = ({ active, onClick, children, testId }) => (
    <button onClick={onClick} data-testid={testId}
      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${active ? "bg-[#0A192F] text-amber-300 border-[#0A192F]" : "bg-white text-slate-600 border-slate-300 hover:border-amber-500"}`}>{children}</button>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-16" data-testid="catalog-page">
      <PageHeader eyebrow="Course catalog" title="Every course, one standard." sub="Choose by level, topic or budget. Each course includes free preview lessons so you can judge the teaching before you enrol."
        right={
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search courses…" className="input-lux !pl-9" data-testid="catalog-search" />
          </div>
        } />

      <div className="card-lux p-5 mb-10 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider"><SlidersHorizontal size={14} /> Filters</div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-400 w-14">Level</span>
          <Chip active={!f.level} onClick={() => setF({ ...f, level: "" })} testId="filter-level-all">All</Chip>
          {filters.levels.map((l) => <Chip key={l} active={f.level === l} onClick={() => setF({ ...f, level: l })} testId={`filter-level-${l.toLowerCase()}`}>{l}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-400 w-14">Topic</span>
          <Chip active={!f.topic} onClick={() => setF({ ...f, topic: "" })} testId="filter-topic-all">All</Chip>
          {filters.topics.map((t) => <Chip key={t} active={f.topic === t} onClick={() => setF({ ...f, topic: t })} testId={`filter-topic-${t.toLowerCase()}`}>{t}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-400 w-14">Price</span>
          {priceBands.map((p) => <Chip key={p.label} active={f.max_price === p.value} onClick={() => setF({ ...f, max_price: p.value })} testId={`filter-price-${p.value || "any"}`}>{p.label}</Chip>)}
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
  );
}
