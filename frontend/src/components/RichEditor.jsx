import { useEffect, useRef } from "react";
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Link2, Quote, Eraser } from "lucide-react";

const tools = [
  { icon: Bold, cmd: "bold", title: "Bold" },
  { icon: Italic, cmd: "italic", title: "Italic" },
  { icon: Heading2, cmd: "formatBlock", arg: "H2", title: "Heading" },
  { icon: Heading3, cmd: "formatBlock", arg: "H3", title: "Subheading" },
  { icon: Quote, cmd: "formatBlock", arg: "BLOCKQUOTE", title: "Quote" },
  { icon: List, cmd: "insertUnorderedList", title: "Bullets" },
  { icon: ListOrdered, cmd: "insertOrderedList", title: "Numbered" },
  { icon: Link2, cmd: "createLink", prompt: "Link URL (https://…)", title: "Link" },
  { icon: Eraser, cmd: "removeFormat", title: "Clear" },
];

export const RichEditor = ({ value, onChange, placeholder = "Write here…", testId = "rich-editor" }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) ref.current.innerHTML = value || "";
  }, [value]);

  const run = (t) => {
    ref.current?.focus();
    const arg = t.prompt ? window.prompt(t.prompt) : t.arg;
    if (t.prompt && !arg) return;
    document.execCommand(t.cmd, false, arg);
    onChange(ref.current.innerHTML);
  };

  return (
    <div className="rich-editor border border-slate-300 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-amber-500/40">
      <div className="flex flex-wrap gap-0.5 border-b border-slate-200 bg-stone-50 px-2 py-1.5">
        {tools.map((t) => (
          <button key={t.title} type="button" title={t.title} onMouseDown={(e) => { e.preventDefault(); run(t); }}
            className="p-1.5 rounded hover:bg-amber-100 text-slate-600 transition-colors"><t.icon size={15} /></button>
        ))}
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning data-placeholder={placeholder} data-testid={testId}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className="prose-lux px-4 py-3 text-sm focus:outline-none" />
    </div>
  );
};
