import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, Globe2, MonitorPlay } from "lucide-react";
import { api } from "@/lib/api";
import { CourseCard, ContentRow, MembershipBand } from "@/components/Shared";

const HERO = "https://images.unsplash.com/photo-1637589267610-6c66fc2a086b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";

const pillars = [
  { icon: MonitorPlay, title: "Self-paced video", text: "Short, cinematic lessons you can finish between meetings. Progress saves automatically." },
  { icon: Award, title: "Executive-grade material", text: "Built from real coaching experience and practical business scenarios. [DETAILS TO CONFIRM]" },
  { icon: Globe2, title: "Made for global professionals", text: "Culture-aware guidance for teams spanning Asia, Europe and the Americas." },
];

export default function Home() {
  const [courses, setCourses] = useState([]);
  useEffect(() => { api.get("/courses").then((r) => setCourses(r.data)).catch(() => {}); }, []);

  return (
    <div className="bg-[#0A192F]" data-testid="home-page">
      {/* Editorial hero */}
      <section className="relative min-h-[86vh] flex items-center overflow-hidden grain">
        <img src={HERO} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A192F] via-[#0A192F]/90 to-[#0A192F]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F] via-transparent to-[#0A192F]/60" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-28 w-full">
          <div className="max-w-3xl">
            <div className="eyebrow-dark mb-6 rise">Business English Mastery</div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-[#F9F8F3] rise rise-1">
              Speak English like the <span className="text-amber-400 italic">leader</span> you already are.
            </h1>
            <p className="text-base md:text-lg text-slate-300 mt-8 max-w-xl leading-relaxed rise rise-2">
              Premium, self-paced courses for working professionals who want to negotiate, present and write with native-level authority.
            </p>
            <div className="flex flex-wrap gap-4 mt-10 rise rise-3">
              <Link to="/courses" className="btn-gold" data-testid="hero-browse-courses">Explore masterclasses <ArrowRight size={16} /></Link>
              <Link to="/services" className="btn-gold-outline" data-testid="hero-coaching">Work with Winnie</Link>
            </div>
            <div className="flex gap-10 mt-14 text-sm rise rise-4">
              {[["[TBC]", "Professionals coached"], ["[TBC]", "Countries"], ["[TBC]", "Average rating"]].map(([n, l]) => (
                <div key={l}><div className="font-serif text-3xl text-amber-300">{n}</div><div className="text-slate-400 text-xs mt-1 uppercase tracking-wider">{l}</div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Authority strip (placeholder, no invented claims) */}
      <div className="border-y border-[#D4AF37]/10 bg-[#050E1E]">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-mono uppercase tracking-[0.2em] text-slate-500">
          <span className="text-amber-400/70">Trusted by professionals at</span>
          {["[LOGO TO CONFIRM]", "[LOGO TO CONFIRM]", "[LOGO TO CONFIRM]", "[LOGO TO CONFIRM]"].map((l, i) => <span key={i}>{l}</span>)}
        </div>
      </div>

      {/* Featured masterclasses carousel */}
      <ContentRow eyebrow="Featured" title="Signature masterclasses" to="/courses" testId="row-featured-courses">
        {courses.map((c, i) => (
          <div key={c.id} className="min-w-[300px] sm:min-w-[340px] snap-start">
            <CourseCard course={c} delay={i * 80} />
          </div>
        ))}
      </ContentRow>

      {/* Ivory contrast band: the method + pillars */}
      <section className="py-20 px-6 bg-[#F9F8F3] text-[#0A192F]" data-testid="method-band">
        <div className="max-w-7xl mx-auto">
          <div className="eyebrow mb-3">The Winnie Hou method</div>
          <h2 className="font-serif text-3xl sm:text-4xl max-w-2xl leading-tight">Executive communication, taught like a craft.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            {pillars.map((p, i) => (
              <div key={p.title} className="rise" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="w-11 h-11 rounded-lg bg-[#0A192F] text-amber-400 flex items-center justify-center mb-5"><p.icon size={20} /></div>
                <h3 className="font-serif text-xl">{p.title}</h3>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coaching spotlight */}
      <section className="bg-[#0F2342]" data-testid="coaching-spotlight">
        <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-8">
            <div className="eyebrow-dark mb-4">About your coach</div>
            <h2 className="font-serif text-3xl sm:text-4xl leading-snug text-[#F9F8F3]">Winnie Hou has spent [X YEARS TO CONFIRM] helping professionals be heard.</h2>
            <p className="text-slate-300 mt-6 leading-relaxed max-w-2xl">[WINNIE BIO — TO CONFIRM]. Every lesson is designed for busy people: no fluff, no grammar drills, only the language that moves careers.</p>
          </div>
          <div className="lg:col-span-4 lg:text-right">
            <Link to="/about" className="btn-gold" data-testid="about-cta">Meet Winnie</Link>
          </div>
        </div>
      </section>

      {/* Velvet-rope membership CTA */}
      <MembershipBand />
    </div>
  );
}
