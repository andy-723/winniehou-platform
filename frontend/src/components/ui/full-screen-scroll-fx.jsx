import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./full-screen-scroll-fx.css";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const FullScreenScrollFX = forwardRef(function FullScreenScrollFX(
  {
    sections,
    className,
    style,
    header,
    footer,
    gap = 1,
    gridPaddingX = 2,
    showProgress = true,
    debug = false,
    durations = { change: 0.7, snap: 800 },
    reduceMotion,
    bgTransition = "fade",
    parallaxAmount = 4,
    currentIndex,
    onIndexChange,
    initialIndex = 0,
    colors = {
      text: "rgba(245,245,245,0.92)",
      overlay: "rgba(0,0,0,0.35)",
      pageBg: "#ffffff",
      stageBg: "#000000",
    },
    apiRef,
    ariaLabel = "Full screen scroll slideshow",
  },
  ref
) {
  const total = sections.length;
  const [localIndex, setLocalIndex] = useState(clamp(initialIndex, 0, Math.max(0, total - 1)));
  const isControlled = typeof currentIndex === "number";
  const index = isControlled ? clamp(currentIndex, 0, Math.max(0, total - 1)) : localIndex;

  const rootRef = useRef(null);
  const fixedRef = useRef(null);
  const fixedSectionRef = useRef(null);
  const bgRefs = useRef([]);
  const wordRefs = useRef([]);
  const leftTrackRef = useRef(null);
  const rightTrackRef = useRef(null);
  const leftItemRefs = useRef([]);
  const rightItemRefs = useRef([]);
  const progressFillRef = useRef(null);
  const currentNumberRef = useRef(null);
  const headerRef = useRef(null);
  const stRef = useRef(null);
  const lastIndexRef = useRef(index);
  const isAnimatingRef = useRef(false);
  const isSnappingRef = useRef(false);
  const sectionTopRef = useRef([]);
  const goToRef = useRef(() => {});

  const prefersReduced = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const motionOff = reduceMotion ?? prefersReduced;

  const splitWords = (text, sIdx) => {
    const words = text.split(/\s+/).filter(Boolean);
    return words.map((w, i) => (
      <span className="fx-word-mask" key={i}>
        <span className="fx-word" ref={(el) => {
          if (!el) return;
          if (!wordRefs.current[sIdx]) wordRefs.current[sIdx] = [];
          wordRefs.current[sIdx][i] = el;
        }}>{w}</span>
        {i < words.length - 1 ? " " : null}
      </span>
    ));
  };

  const computePositions = () => {
    const el = fixedSectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const h = el.offsetHeight;
    const arr = [];
    for (let i = 0; i < total; i++) arr.push(top + (h * i) / total);
    sectionTopRef.current = arr;
  };

  const measureAndCenterLists = (toIndex = index, animate = true) => {
    const centerTrack = (container, items, isRight) => {
      if (!container || items.length === 0) return;
      const first = items[0];
      const second = items[1];
      const contRect = container.getBoundingClientRect();
      let rowH = first.getBoundingClientRect().height;
      if (second) rowH = second.getBoundingClientRect().top - first.getBoundingClientRect().top;
      const targetY = contRect.height / 2 - rowH / 2 - toIndex * rowH;
      const node = isRight ? rightTrackRef.current : leftTrackRef.current;
      if (!node) return;
      if (animate) {
        gsap.to(node, { y: targetY, duration: (durations.change ?? 0.7) * 0.9, ease: "power3.out" });
      } else {
        gsap.set(node, { y: targetY });
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        centerTrack(leftTrackRef.current?.parentElement, leftItemRefs.current, false);
        centerTrack(rightTrackRef.current?.parentElement, rightItemRefs.current, true);
      });
    });
  };

  const changeSection = (to) => {
    if (to === lastIndexRef.current || isAnimatingRef.current) return;
    const from = lastIndexRef.current;
    const down = to > from;
    isAnimatingRef.current = true;
    if (!isControlled) setLocalIndex(to);
    onIndexChange?.(to);
    if (currentNumberRef.current) currentNumberRef.current.textContent = String(to + 1).padStart(2, "0");
    const D = durations.change ?? 0.7;

    const outWords = wordRefs.current[from] || [];
    const inWords = wordRefs.current[to] || [];
    if (outWords.length) gsap.to(outWords, { opacity: 0, yPercent: 0, duration: D * 0.3, ease: "power2.out" });
    if (inWords.length) {
      gsap.set(inWords, { yPercent: down ? 40 : -40, opacity: 0 });
      gsap.to(inWords, { yPercent: 0, opacity: 1, duration: D, stagger: down ? 0.05 : -0.05, ease: "power3.out" });
    }

    const prevBg = bgRefs.current[from];
    const newBg = bgRefs.current[to];
    if (bgTransition === "fade") {
      if (newBg) {
        gsap.set(newBg, { opacity: 0, scale: 1.04, yPercent: down ? 1 : -1 });
        gsap.to(newBg, { opacity: 1, scale: 1, yPercent: 0, duration: D, ease: "power2.out" });
      }
      if (prevBg) {
        gsap.to(prevBg, { opacity: 0, yPercent: down ? -parallaxAmount : parallaxAmount, duration: D, ease: "power2.out" });
      }
    } else if (newBg) {
      gsap.set(newBg, { opacity: 1, clipPath: down ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)", scale: 1, yPercent: 0 });
      gsap.to(newBg, { clipPath: "inset(0 0 0 0)", duration: D, ease: "power3.out" });
      if (prevBg) gsap.to(prevBg, { opacity: 0, duration: D * 0.8, ease: "power2.out" });
    }

    measureAndCenterLists(to, true);
    leftItemRefs.current.forEach((el, i) => {
      if (!el) return;
      el.classList.toggle("active", i === to);
      gsap.to(el, { opacity: i === to ? 1 : 0.35, x: i === to ? 10 : 0, duration: D * 0.6, ease: "power3.out" });
    });
    rightItemRefs.current.forEach((el, i) => {
      if (!el) return;
      el.classList.toggle("active", i === to);
      gsap.to(el, { opacity: i === to ? 1 : 0.35, x: i === to ? -10 : 0, duration: D * 0.6, ease: "power3.out" });
    });

    gsap.delayedCall(D, () => {
      lastIndexRef.current = to;
      isAnimatingRef.current = false;
    });
  };

  const goTo = (to, withScroll = true) => {
    const clamped = clamp(to, 0, total - 1);
    isSnappingRef.current = true;
    changeSection(clamped);
    const pos = sectionTopRef.current[clamped];
    const snapMs = durations.snap ?? 800;
    if (withScroll && typeof window !== "undefined" && Number.isFinite(pos)) {
      window.scrollTo({ top: pos, behavior: "smooth" });
      setTimeout(() => { isSnappingRef.current = false; }, snapMs);
    } else {
      setTimeout(() => { isSnappingRef.current = false; }, 10);
    }
  };
  goToRef.current = goTo;

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const fs = fixedSectionRef.current;
    if (!fs || total === 0) return undefined;

    gsap.set(bgRefs.current, { opacity: 0, scale: 1.04, yPercent: 0 });
    if (bgRefs.current[0]) gsap.set(bgRefs.current[0], { opacity: 1, scale: 1 });
    wordRefs.current.forEach((words, sIdx) => {
      (words || []).forEach((w) => {
        gsap.set(w, { yPercent: sIdx === index ? 0 : 100, opacity: sIdx === index ? 1 : 0 });
      });
    });
    computePositions();
    measureAndCenterLists(index, false);

    const st = ScrollTrigger.create({
      trigger: fs,
      start: "top top",
      end: "bottom bottom",
      pin: false,
      onUpdate: (self) => {
        if (progressFillRef.current) progressFillRef.current.style.width = `${self.progress * 100}%`;
        if (motionOff || isSnappingRef.current) return;
        const target = Math.min(total - 1, Math.floor(self.progress * total));
        if (target !== lastIndexRef.current && !isAnimatingRef.current) {
          const next = lastIndexRef.current + (target > lastIndexRef.current ? 1 : -1);
          goToRef.current(next, false);
        }
      },
    });
    stRef.current = st;

    const ro = new ResizeObserver(() => {
      computePositions();
      measureAndCenterLists(lastIndexRef.current, false);
      ScrollTrigger.refresh();
    });
    ro.observe(fs);
    return () => {
      ro.disconnect();
      st.kill();
      stRef.current = null;
    };
    // The scroll watcher is created once per section count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, motionOff, bgTransition, parallaxAmount]);

  useImperativeHandle(apiRef, () => ({
    next: () => goTo(lastIndexRef.current + 1),
    prev: () => goTo(lastIndexRef.current - 1),
    goTo,
    getIndex: () => lastIndexRef.current,
    refresh: () => ScrollTrigger.refresh(),
  }));

  const handleJump = (i) => goTo(i);
  const onItemKey = (event, i) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleJump(i);
    }
  };

  const cssVars = {
    "--fx-text": colors.text ?? "rgba(245,245,245,0.92)",
    "--fx-overlay": colors.overlay ?? "rgba(0,0,0,0.35)",
    "--fx-page-bg": colors.pageBg ?? "#fff",
    "--fx-stage-bg": colors.stageBg ?? "#000",
    "--fx-gap": `${gap}rem`,
    "--fx-grid-px": `${gridPaddingX}rem`,
    "--fx-row-gap": "10px",
  };

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={["fx", className].filter(Boolean).join(" ")}
      style={{ ...cssVars, ...style }}
      aria-label={ariaLabel}
    >
      {debug && <div className="fx-debug">Section: {index}</div>}
      <div className="fx-fixed-section" ref={fixedSectionRef} style={{ height: `${sections.length * 100}vh` }}>
        <div className="fx-fixed" ref={fixedRef}>
          <div className="fx-bgs" aria-hidden="true">
            {sections.map((s, i) => (
              <div className="fx-bg" key={s.id ?? i}>
                <img
                  ref={(el) => { if (el) bgRefs.current[i] = el; }}
                  src={s.background}
                  alt={s.alt || ""}
                  className="fx-bg-img"
                />
                <div className="fx-bg-overlay" />
              </div>
            ))}
          </div>
          <div className="fx-grid">
            {header && <div className="fx-header" ref={headerRef}>{header}</div>}
            <div className="fx-content">
              <div className="fx-left">
                <div className="fx-track" ref={leftTrackRef}>
                  {sections.map((s, i) => (
                    <button
                      key={`L-${s.id ?? i}`}
                      type="button"
                      className={`fx-item fx-left-item ${i === index ? "active" : ""}`}
                      ref={(el) => { if (el) leftItemRefs.current[i] = el; }}
                      onClick={() => handleJump(i)}
                      onKeyDown={(event) => onItemKey(event, i)}
                      aria-pressed={i === index}
                    >
                      {s.leftLabel}
                    </button>
                  ))}
                </div>
              </div>
              <div className="fx-center">
                {sections.map((s, sIdx) => {
                  const isString = typeof s.title === "string";
                  return (
                    <div key={`C-${s.id ?? sIdx}`} className={`fx-featured ${sIdx === index ? "active" : ""}`}>
                      <h3 className="fx-featured-title">{isString ? splitWords(s.title, sIdx) : s.title}</h3>
                    </div>
                  );
                })}
              </div>
              <div className="fx-right">
                <div className="fx-track" ref={rightTrackRef}>
                  {sections.map((s, i) => (
                    <button
                      key={`R-${s.id ?? i}`}
                      type="button"
                      className={`fx-item fx-right-item ${i === index ? "active" : ""}`}
                      ref={(el) => { if (el) rightItemRefs.current[i] = el; }}
                      onClick={() => handleJump(i)}
                      onKeyDown={(event) => onItemKey(event, i)}
                      aria-pressed={i === index}
                    >
                      {s.rightLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="fx-footer">
              {footer && <div className="fx-footer-title">{footer}</div>}
              {showProgress && (
                <div className="fx-progress">
                  <div className="fx-progress-numbers">
                    <span ref={currentNumberRef}>{String(index + 1).padStart(2, "0")}</span>
                    <span>{String(total).padStart(2, "0")}</span>
                  </div>
                  <div className="fx-progress-fill" ref={progressFillRef} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
