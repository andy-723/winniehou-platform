import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, FileText, PanelLeftClose, PanelLeftOpen, Lock, Download } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Spinner } from "@/components/Shared";

export default function Player() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [railOpen, setRailOpen] = useState(true);

  const flat = useMemo(() => course ? course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, module_title: m.title }))) : [], [course]);
  const lessonId = params.get("lesson") || progress?.last_lesson_id || flat.find((l) => !l.locked)?.id;
  const idx = flat.findIndex((l) => l.id === lessonId);

  const loadProgress = useCallback(() => {
    if (!user) return;
    api.get(`/courses/${slug}/progress`).then((r) => setProgress(r.data)).catch(() => {});
  }, [slug, user]);

  useEffect(() => {
    if (user === null) return;
    api.get(`/courses/${slug}`).then((r) => setCourse(r.data)).catch(() => setCourse(false));
    loadProgress();
  }, [slug, user, loadProgress]);

  useEffect(() => {
    if (!course || !lessonId) return;
    setLesson(null);
    api.get(`/courses/${course.id}/lessons/${lessonId}`).then((r) => setLesson(r.data))
      .catch((e) => { toast.error(errMsg(e)); setLesson(false); });
  }, [course, lessonId]);

  const save = async (position, completed = false) => {
    if (!course?.enrolled) return;
    try {
      await api.post(`/courses/${course.id}/lessons/${lessonId}/progress`, { position_seconds: position, completed });
      if (completed) loadProgress();
    } catch {}
  };

  const go = (l) => setParams({ lesson: l.id });
  const markComplete = async () => { await save(lesson?.progress?.position_seconds || 0, true); toast.success("Lesson completed"); };

  if (course === null || user === null) return <div className="min-h-screen bg-[#0B1120]"><Spinner /></div>;
  if (course === false) return <div className="min-h-screen bg-[#0B1120] text-white text-center py-32 font-serif text-2xl">Course not found.</div>;

  const done = (id) => progress?.lessons?.[id]?.completed;
  const pct = progress?.percent || 0;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col" data-testid="player-page">
      <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-[#070D18]">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setRailOpen(!railOpen)} className="p-2 rounded hover:bg-white/5" data-testid="toggle-rail">{railOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</button>
          <Link to={`/courses/${slug}`} className="text-sm text-slate-400 hover:text-white truncate" data-testid="back-to-course">← {course.title}</Link>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {course.enrolled && <span className="hidden sm:flex items-center gap-2 text-slate-400" data-testid="course-progress-pct"><span className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden"><span className="block h-full bg-amber-500 transition-[width] duration-500" style={{ width: `${pct}%` }} /></span>{pct}%</span>}
          {!course.enrolled && <button onClick={() => nav(`/courses/${slug}`)} className="btn-gold !py-1.5 !px-3 !text-xs" data-testid="player-enroll-btn">Enrol to unlock</button>}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className={`${railOpen ? "w-80" : "w-0"} shrink-0 transition-[width] duration-300 overflow-hidden border-r border-slate-800 bg-[#070D18]`} data-testid="curriculum-rail">
          <div className="w-80 h-[calc(100vh-56px)] overflow-y-auto scrollbar-thin">
            {course.modules.map((m, mi) => (
              <div key={m.id}>
                <div className="px-5 pt-5 pb-2 text-[11px] font-mono uppercase tracking-widest text-slate-500">{String(mi + 1).padStart(2, "0")} · {m.title}</div>
                {m.lessons.map((l) => (
                  <button key={l.id} onClick={() => !l.locked && go(l)} disabled={l.locked} data-testid={`rail-lesson-${l.id}`}
                    className={`w-full text-left px-5 py-3 flex items-start gap-3 text-sm border-l-2 transition-colors ${l.id === lessonId ? "border-amber-500 bg-white/5 text-white" : "border-transparent text-slate-400 hover:text-white hover:bg-white/[.03]"} disabled:opacity-40 disabled:cursor-not-allowed`}>
                    {l.locked ? <Lock size={15} className="mt-0.5 shrink-0" /> : done(l.id) ? <CheckCircle2 size={15} className="mt-0.5 text-amber-500 shrink-0" /> : <Circle size={15} className="mt-0.5 shrink-0" />}
                    <span className="flex-1 leading-snug">{l.title}</span>
                    <span className="text-[11px] text-slate-600 shrink-0">{l.duration_minutes}m</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            {lesson === null ? <Spinner /> : lesson === false ? (
              <div className="text-center py-20 text-slate-400">This lesson is locked. <Link to={`/courses/${slug}`} className="text-amber-400 underline">Enrol</Link> to continue.</div>
            ) : (
              <>
                <VideoPlayer video={lesson.video} watermark={lesson.watermark} startAt={lesson.progress?.position_seconds || 0}
                  onProgress={(t) => save(t)} onEnded={() => save(0, true)} />
                <div className="flex items-start justify-between gap-6 mt-8">
                  <div>
                    <div className="eyebrow !text-amber-500">{flat[idx]?.module_title}</div>
                    <h1 className="font-serif text-2xl sm:text-3xl mt-2" data-testid="lesson-title">{lesson.title}</h1>
                  </div>
                  {course.enrolled && (
                    <button onClick={markComplete} disabled={done(lesson.id)} data-testid="mark-complete-btn"
                      className={`shrink-0 inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-colors ${done(lesson.id) ? "border-amber-500/40 text-amber-400" : "border-slate-700 hover:border-amber-500 text-slate-300"}`}>
                      <CheckCircle2 size={16} /> {done(lesson.id) ? "Completed" : "Mark complete"}
                    </button>
                  )}
                </div>
                {lesson.attachments?.length > 0 && (
                  <div className="mt-8" data-testid="lesson-attachments">
                    <div className="eyebrow !text-slate-500 mb-3">Downloads</div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {lesson.attachments.map((a) => (
                        <a key={a.file_id} href={fileUrl(a.file_id, true)} target="_blank" rel="noreferrer" data-testid={`attachment-${a.file_id}`}
                          className="flex items-center gap-3 bg-[#0F172A] border border-slate-800 hover:border-amber-500/50 rounded-lg px-4 py-3 text-sm transition-colors">
                          <FileText size={18} className="text-amber-500" /><span className="flex-1 truncate">{a.name}</span><Download size={15} className="text-slate-500" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div className="prose-lux prose-dark mt-8" dangerouslySetInnerHTML={{ __html: lesson.content }} />
                <div className="flex justify-between mt-12 pt-6 border-t border-slate-800">
                  <button disabled={idx <= 0 || flat[idx - 1]?.locked} onClick={() => go(flat[idx - 1])} className="btn-outline !bg-transparent !text-slate-300 !border-slate-700 disabled:opacity-30" data-testid="prev-lesson-btn"><ChevronLeft size={16} /> Previous</button>
                  <button disabled={idx >= flat.length - 1 || flat[idx + 1]?.locked} onClick={() => go(flat[idx + 1])} className="btn-gold disabled:opacity-30" data-testid="next-lesson-btn">Next lesson <ChevronRight size={16} /></button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
