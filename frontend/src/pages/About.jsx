import { Link } from "react-router-dom";
import { PageHeader } from "@/components/Shared";

const ABOUT_IMG = "https://images.unsplash.com/photo-1637589267610-6c66fc2a086b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function About() {
  return (
    <div data-testid="about-page">
      <section className="max-w-7xl mx-auto px-6 py-16">
        <PageHeader eyebrow="About" title="Meet Winnie Hou" sub="[WINNIE TAGLINE TO COME]" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-6">
            <div className="prose-lux">
              <p>[WINNIE BIO — her story, how she started coaching, and who she helps. TO COME]</p>
            </div>
            <div>
              <h3 className="font-serif text-xl text-[#0A192F] mb-2">Credentials</h3>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                <li>[CREDENTIAL TO COME]</li>
                <li>[CREDENTIAL TO COME]</li>
                <li>[CREDENTIAL TO COME]</li>
              </ul>
            </div>
            <div>
              <h3 className="font-serif text-xl text-[#0A192F] mb-2">Approach</h3>
              <p className="text-sm text-slate-600 leading-relaxed">[APPROACH TO COME — how Winnie works with clients, what makes her method different.]</p>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-[#0A192F]">
              <img src={ABOUT_IMG} alt="Winnie Hou" className="w-full h-full object-cover" />
            </div>
            <div className="card-lux mt-6 p-6 text-center text-sm text-slate-400" data-testid="about-video-slot">[MEDIA / VIDEO SLOT — embed to come]</div>
          </div>
        </div>
        <div className="mt-16">
          <div className="eyebrow mb-4">What clients say</div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <div key={i} className="card-lux p-6 text-sm text-slate-400" data-testid={`about-testimonial-${i}`}>[TESTIMONIAL TO CONFIRM]</div>)}
          </div>
        </div>
        <div className="text-center mt-14"><Link to="/services" className="btn-gold" data-testid="about-services-cta">Work with Winnie</Link></div>
      </section>
    </div>
  );
}
