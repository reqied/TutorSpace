import katex from "katex";
import { useState } from "react";
function Inline({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|https?:\/\/[^\s]+|`[^`\n]+`)/g)
        .map((part, i) => {
          if (part.startsWith("$")) {
            const display = part.startsWith("$$");
            return (
              <span
                key={i}
                className={display ? "math-block" : ""}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(
                    part.slice(display ? 2 : 1, display ? -2 : -1),
                    {
                      displayMode: display,
                      throwOnError: false,
                      trust: false,
                      maxExpand: 1000,
                    },
                  ),
                }}
              />
            );
          }
          if (part.startsWith("`"))
            return (
              <code className="inline-code" key={i}>
                {part.slice(1, -1)}
              </code>
            );
          if (/^https?:\/\//.test(part))
            return (
              <a key={i} href={part} target="_blank" rel="noreferrer">
                {part}
              </a>
            );
          return <span key={i}>{part}</span>;
        })}
    </>
  );
}
function Code({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="code-block">
      <header>
        <span>{language || "Код"}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </header>
      <pre>
        <code>{code}</code>
      </pre>
    </section>
  );
}
export default function Content({ text }: { text: string }) {
  const blocks = [];
  const pattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  let cursor = 0,
    match;
  while ((match = pattern.exec(text || ""))) {
    blocks.push(
      <Inline key={"t" + cursor} text={text.slice(cursor, match.index)} />,
    );
    blocks.push(
      <Code
        key={"c" + match.index}
        language={match[1].trim()}
        code={match[2].replace(/\n$/, "")}
      />,
    );
    cursor = pattern.lastIndex;
  }
  blocks.push(
    <Inline key={"last" + cursor} text={(text || "").slice(cursor)} />,
  );
  return <div className="material-text">{blocks}</div>;
}
