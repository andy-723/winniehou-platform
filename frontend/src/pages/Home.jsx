import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, Globe2, MonitorPlay, Quote } from "lucide-react";
import { api } from "@/lib/api";
import { CourseCard } from "@/components/Shared";

const HERO = "https://images.unsplash.com/photo-1637589267610-6c66fc2a086b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

const pillars = [
  { icon: MonitorPlay, title: "Self-paced video", text: "Short, cinematic lessons you can finish between meetings. Progress saves automatically." },
  { icon: Award, title: "Executive-grade material", text: "Built from real coaching experience and practical business scenarios. [DETAILS TO CONFIRM]" },
  { icon: Globe2, title: "Made for global professionals", text: "Culture-aware guidance for teams spanning Asia, Europe and the Americas." },
];

export default function Home() {
  const [courses, setCourses] = useState([]);
  useEffect(() => { api.get("/courses").then((r) => setCourses(r.data.slice(0, 3))).catch(() => {}); }, []);

  return (
    <div data-testid="home-page">
      <section className="relative bg-[#0A192F] text-white overflow-hidden grain">
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="eyebrow !text-amber-400 mb-6 rise">Business English Mastery</div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight rise rise-1">
              Speak English like the <span className="text-amber-400 italic">leader</span> you already are.
            </h1>
            <p className="text-base md:text-lg text-slate-300 mt-8 max-w-xl leading-relaxed rise rise-2">
              Premium, self-paced courses for working professionals who want to negotiate, present and write with native-level authority.
            </p>
            <div className="flex flex-wrap gap-4 mt-10 rise rise-3">
              <Link to="/courses" className="btn-gold" data-testid="hero-browse-courses">Browse courses <ArrowRight size={16} /></Link>
              <Link to="/shop" className="btn-outline !bg-transparent !text-white !border-white/30 hover:!bg-white/5" data-testid="hero-shop">Explore workbooks</Link>
            </div>
            <div className="flex gap-10 mt-14 text-sm rise rise-4">
              {[["[TBC]", "Professionals coached"], ["[TBC]", "Countries"], ["[TBC]", "Average rating"]].map(([n, l]) => (
                <div key={l}><div className="font-serif text-3xl text-amber-300">{n}</div><div className="text-slate-400 text-xs mt-1 uppercase tracking-wider">{l}</div></div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 relative rise rise-2">
            <div className="absolute -inset-4 border border-amber-500/30 rounded-2xl translate-x-4 translate-y-4" />
            <img src={HERO} alt="Winnie Hou coaching" className="relative rounded-2xl shadow-2xl aspect-[4/5] object-cover w-full" />
            <div className="absolute -bottom-6 -left-6 bg-white text-[#0A192F] p-5 rounded-xl shadow-xl max-w-[240px]">
              <Quote size={18} className="text-amber-500 mb-2" />
              <p className="text-sm leading-snug italic font-serif">"[CLIENT TESTIMONIAL TO CONFIRM]"</p>
              <div className="text-xs text-slate-500 mt-2">— [CLIENT NAME & ROLE TO CONFIRM]</div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pillars.map((p, i) => (
            <div key={p.title} className="card-lux p-8 rise" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="w-11 h-11 rounded-lg bg-[#0A192F] text-amber-400 flex items-center justify-center mb-6"><p.icon size={20} /></div>
              <h3 className="font-serif text-xl text-[#0A192F]">{p.title}</h3>
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="eyebrow mb-3">Featured</div>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#0A192F]">Start with a signature course</h2>
          </div>
          <Link to="/courses" className="hidden md:inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800" data-testid="home-view-all">View all <ArrowRight size={14} /></Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courses.map((c, i) => <CourseCard key={c.id} course={c} delay={i * 100} />)}
        </div>
      </section>

      <section className="bg-[#0F2342] text-white">
        <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-8">
            <div className="eyebrow !text-amber-400 mb-4">About your coach</div>
            <h2 className="font-serif text-3xl sm:text-4xl leading-snug">Winnie Hou has spent [X YEARS TO CONFIRM] helping professionals be heard.</h2>
            <p className="text-slate-300 mt-6 leading-relaxed max-w-2xl">[WINNIE BIO — TO CONFIRM]. Every lesson is designed for busy people: no fluff, no grammar drills, only the language that moves careers.</p>
          </div>
          <div className="lg:col-span-4 lg:text-right">
            <Link to="/about" className="btn-gold" data-testid="about-cta">Meet Winnie</Link>
          </div>
        </div>
      </section>

      <section className="bg-[#0A192F] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <div className="eyebrow !text-amber-400 mb-3">Coaching</div>
          <h2 className="font-serif text-3xl sm:text-4xl">Work with Winnie one-to-one.</h2>
          <p className="text-slate-300 mt-4 max-w-xl mx-auto">Personalised coaching packages for career growth, interviews and executive communication.</p>
          <Link to="/services" className="btn-gold mt-8 inline-flex" data-testid="home-services-cta">Explore coaching <ArrowRight size={16} /></Link>
        </div>
      </section>
    </div>
  );
}
