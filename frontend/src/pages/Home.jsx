import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, Globe2, MonitorPlay } from "lucide-react";
import { api } from "@/lib/api";
import { CourseCard, ContentRow, MembershipBand } from "@/components/Shared";
import { InfiniteSlider } from "@/components/ui/infinite-slider";

const CHIPS = ["Career strategist", "Interview coach", "Business English"];
const INDEX = [
  { href: "/services", label: "Career coaching" },
  { href: "/services#interview", label: "Interviews" },
  { href: "/services#quantum-leap", label: "Business English" },
  { href: "/courses", label: "Courses" },
];
const INTRO_CONFIRMED = "Winnie Hou coaches professionals into roles at Australia's leading firms, one to one, with career strategy, interview preparation and business English that sounds senior.";
const INTRO_OPEN = "Winnie Hou coaches professionals into the roles they're aiming for, one to one, with career strategy, interview preparation and business English that sounds senior.";
const STATS = [["[TBC]", "Professionals coached"], ["[TBC]", "Countries"], ["[TBC]", "Average rating"]];

const pillars = [
  { icon: MonitorPlay, title: "Self-paced video", text: "Short, cinematic lessons you can finish between meetings. Progress saves automatically." },
  { icon: Award, title: "Executive-grade material", text: "Built from real coaching experience and practical business scenarios. [DETAILS TO CONFIRM]" },
  { icon: Globe2, title: "Made for global professionals", text: "Culture-aware guidance for teams spanning Asia, Europe and the Americas." },
];

const emptySlot = { url: "", alt: "" };

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduce;
}

function Portrait({ slot, mobileSlot }) {
  const desktop = slot?.url || "";
  const mobile = mobileSlot?.url || desktop;
  const frame = "absolute bottom-0 left-1/2 -translate-x-1/2 h-[58%] w-[78%] max-w-[360px] min-[860px]:h-[92%] min-[860px]:w-[31%] min-[860px]:max-w-none object-contain object-bottom";
  if (!desktop && !mobile) {
    return (
        <div className={`${frame} bg-gradient-to-b from-[#0A192F] via-[#0F2342] to-[#D4AF37]/35 flex items-center justify-center`} data-testid="hero-portrait-placeholder">
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#F9F8F3]/70 -translate-y-6">Portrait coming soon</span>
      </div>
    );
  }
  return (
    <>
      {mobile && (
        <img src={mobile} alt={mobileSlot?.url ? (mobileSlot.alt || "") : (slot?.alt || "")} width="360" height="480" className={`${frame} min-[860px]:hidden`} data-testid="hero-portrait-mobile" />
      )}
      {(desktop || mobile) && (
        <img src={desktop || mobile} alt={slot?.alt || mobileSlot?.alt || ""} width="480" height="720" className={`${frame} hidden min-[860px]:block`} data-testid="hero-portrait" />
      )}
    </>
  );
}

function SideFrame({ slot, side }) {
  if (!slot?.url) return null;
  const pos = side === "left" ? "left-[20%]" : "right-[20%]";
  return (
    <img src={slot.url} alt={slot.alt || ""} width="160" height="213" className={`hidden min-[860px]:block absolute top-[30%] ${pos} w-[12%] aspect-[3/4] object-cover border border-[#D4AF37]/70 z-10`} data-testid={`hero-side-${side}`} />
  );
}

function LogoRow({ logos }) {
  return logos.map((l) => (
    <img key={l.id} src={l.logo_url} alt={l.alt || l.name} className="h-[26px] min-[860px]:h-9 w-auto opacity-65 hover:opacity-100 [filter:brightness(0)_invert(1)]" />
  ));
}

export default function Home() {
  const [courses, setCourses] = useState([]);
  const [hero, setHero] = useState(null);
  const [gap, setGap] = useState(80);
  const reduce = useReducedMotion();

  useEffect(() => { api.get("/courses").then((r) => setCourses(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    api.get("/homepage").then((r) => setHero(r.data)).catch(() => setHero({ placements: [], portrait: emptySlot, portrait_mobile: emptySlot, side_left: emptySlot, side_right: emptySlot }));
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 859px)");
    const apply = () => setGap(mq.matches ? 48 : 80);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    const url = hero?.portrait?.url;
    if (!url) return undefined;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = url;
    document.head.appendChild(link);
    return () => link.remove();
  }, [hero]);

  const placements = hero?.placements || [];
  const showSlider = placements.length >= 3;
  const intro = showSlider ? INTRO_CONFIRMED : INTRO_OPEN;

  return (
    <div className="bg-[#0A192F]" data-testid="home-page">
      <section className="relative bg-[#0A192F] text-[#F9F8F3]" data-testid="home-hero">
        <div className="relative h-[540px] min-[860px]:h-[640px] overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 42% 36% at 50% 32%, rgba(212,175,55,0.30), transparent 70%)" }} />
          <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[34%] -translate-x-1/2" aria-hidden="true" style={{ background: "linear-gradient(to bottom, rgba(212,175,55,0.28), transparent 62%)", clipPath: "polygon(18% 0, 82% 0, 100% 100%, 0 100%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-6 min-[860px]:top-4 text-center leading-[0.92] select-none">
            <div className="min-[860px]:hidden font-serif font-black uppercase text-[16vw] text-transparent" style={{ WebkitTextStroke: "1px rgba(212,175,55,0.38)" }}>
              <div>WINNIE</div>
              <div>HOU</div>
            </div>
            <div className="hidden min-[860px]:block font-serif font-black uppercase text-[17.5vw] text-transparent" style={{ WebkitTextStroke: "1px rgba(212,175,55,0.38)" }}>
              WINNIE HOU
            </div>
          </div>
          <SideFrame slot={hero?.side_left} side="left" />
          <SideFrame slot={hero?.side_right} side="right" />
          <nav className="hidden min-[860px]:flex absolute top-[63%] inset-x-0 z-10 px-[8%] justify-between pointer-events-none" aria-label="Site sections">
            {INDEX.map((item) => (
              <Link key={item.href} to={item.href} className="pointer-events-auto font-mono text-[11px] tracking-[0.16em] uppercase text-[#F9F8F3]/80 hover:text-[#D4AF37]">
                // {item.label}<span className="block h-px w-10 bg-[#D4AF37]/50 mt-2" />
              </Link>
            ))}
          </nav>
          <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#0A192F] to-transparent z-[15] pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 z-20 h-full pointer-events-none">
            <Portrait slot={hero?.portrait} mobileSlot={hero?.portrait_mobile} />
          </div>
        </div>

        <div className={`relative z-30 -mt-52 min-[860px]:-mt-36 px-6 text-center ${reduce ? "" : "rise"}`}>
          <div className="flex flex-wrap justify-center gap-2">
            {CHIPS.map((c) => (
              <span key={c} className="font-mono text-[10px] tracking-[0.18em] uppercase bg-[#D4AF37] text-[#0A192F] px-2.5 py-1 rounded-[2px]">{c}</span>
            ))}
          </div>
          <h1 className="font-serif font-bold text-[40px] min-[860px]:text-[72px] leading-[1.02] tracking-tight mt-4 text-[#F9F8F3]" style={{ textWrap: "balance" }}>
            Command the room. <span className="italic font-medium text-[#D4AF37]">Then the offer.</span>
          </h1>
          <p className="text-[17px] leading-relaxed text-[#F9F8F3]/80 max-w-[52ch] mx-auto mt-4">{intro}</p>
          <div className="flex flex-col min-[860px]:flex-row items-stretch min-[860px]:items-center justify-center gap-3 mt-6 min-[860px]:w-auto">
            <Link to="/book?src=website" className="inline-flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#e0c15a] text-[#0A192F] font-semibold px-6 py-3 rounded-[2px] min-[860px]:w-auto" data-testid="hero-book">
              Book a discovery call <ArrowRight size={16} />
            </Link>
            <Link to="/courses" className="inline-flex items-center justify-center gap-2 border border-[#F9F8F3]/70 text-[#F9F8F3] font-semibold px-6 py-3 rounded-[2px] hover:bg-[#F9F8F3]/10" data-testid="hero-courses">
              Explore courses
            </Link>
          </div>
        </div>
        <div className="mt-8" aria-hidden="true" data-testid="hero-stripes">
          {[1, 0.7, 0.45, 0.25].map((opacity) => (
            <div key={opacity} className="h-[3px] bg-[#D4AF37] mb-1" style={{ opacity }} />
          ))}
        </div>
      </section>

      {showSlider && (
        <section className="bg-[#0A192F] pt-8 pb-6" data-testid="client-logo-slider">
          <div className="font-mono text-[11px] tracking-[0.24em] text-center text-[#9FB0C8]">WHERE OUR CLIENTS NOW WORK</div>
          <div className="mt-6 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            {reduce ? (
              <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 px-6">
                <LogoRow logos={placements} />
              </div>
            ) : (
              <InfiniteSlider gap={gap} duration={40} durationOnHover={80}>
                <LogoRow logos={placements} />
              </InfiniteSlider>
            )}
          </div>
          <p className="text-[11px] text-[#9FB0C8] text-center mt-5 px-6">Logos are trademarks of their owners and show where clients have been employed. They don't imply endorsement.</p>
        </section>
      )}

      <div className="border-y border-[#D4AF37]/10 bg-[#050E1E]" data-testid="home-stats">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-sm">
          {STATS.map(([n, l]) => (
            <div key={l} className="text-center">
              <div className="font-serif text-3xl text-amber-300">{n}</div>
              <div className="text-slate-400 text-xs mt-1 uppercase tracking-wider">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <ContentRow eyebrow="Featured" title="Signature masterclasses" to="/courses" testId="row-featured-courses">
        {courses.map((c, i) => (
          <div key={c.id} className="min-w-[300px] sm:min-w-[340px] snap-start">
            <CourseCard course={c} delay={i * 80} />
          </div>
        ))}
      </ContentRow>

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

      <MembershipBand />
    </div>
  );
}
