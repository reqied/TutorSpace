import { useRef, useState } from "react";
import Content from "./Content";
export default function TextEditor({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null),
    [language, setLanguage] = useState("python"),
    [preview, setPreview] = useState(false);
  function insert() {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart,
      end = el.selectionEnd;
    const selected = value.slice(start, end) || 'print("Hello")';
    const snippet = "\n```" + language + "\n" + selected + "\n```\n";
    onChange(value.slice(0, start) + snippet + value.slice(end));
    setPreview(false);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        start + 5 + language.length,
        start + 5 + language.length + selected.length,
      );
    });
  }
  return (
    <div className="text-editor">
      <div className="editor-tools">
        <span>{label}</span>
        <div>
          <select
            aria-label="Язык кода"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {[
              "python",
              "csharp",
              "javascript",
              "typescript",
              "sql",
              "html",
              "bash",
              "text",
            ].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <button type="button" className="outline" onClick={insert}>
            Вставить код
          </button>
          <button
            type="button"
            className="outline"
            onClick={() => setPreview(!preview)}
          >
            {preview ? "Редактировать" : "Предпросмотр"}
          </button>
        </div>
      </div>
      <textarea
        ref={ref}
        aria-label={label}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        hidden={preview}
        placeholder={"Текст, $LaTeX$, ссылки и блоки кода"}
      />
      {preview && (
        <div className="editor-preview">
          <Content text={value} />
        </div>
      )}
    </div>
  );
}
