import { useEffect, useMemo, useRef } from "react";

const marks = Array.from({ length: 12 }, (_, i) => i);

export const VideoPlayer = ({ video, watermark, startAt = 0, onProgress, onEnded }) => {
  const ref = useRef(null);
  const lastSave = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || video?.provider !== "url") return;
    const seek = () => { if (startAt > 1) el.currentTime = startAt; };
    el.addEventListener("loadedmetadata", seek, { once: true });
    return () => el.removeEventListener("loadedmetadata", seek);
  }, [video, startAt]);

  const positions = useMemo(() => marks.map((i) => ({
    top: `${(i % 4) * 25 + 8}%`, left: `${Math.floor(i / 4) * 33 + 5}%`,
  })), []);

  const handleTime = (e) => {
    const t = e.target.currentTime;
    if (t - lastSave.current > 10) { lastSave.current = t; onProgress?.(t); }
  };

  return (
    <div className="relative bg-black rounded-xl overflow-hidden aspect-video shadow-2xl ring-1 ring-white/10" data-testid="video-player">
      {!video && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">No video attached to this lesson yet.</div>
      )}
      {video?.provider === "url" && (
        <video ref={ref} src={video.src} controls controlsList="nodownload" onContextMenu={(e) => e.preventDefault()}
          onTimeUpdate={handleTime} onEnded={onEnded} className="w-full h-full" data-testid="video-element" />
      )}
      {video?.provider === "bunny" && (
        <iframe src={video.embed_url} title="Lesson video" allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen className="w-full h-full border-0" data-testid="video-iframe" />
      )}
      {watermark && (
        <div className="watermark" data-testid="video-watermark">
          {positions.map((p, i) => <span key={i} style={p}>{watermark}</span>)}
        </div>
      )}
    </div>
  );
};
