"use client";

import { Fragment, useState, type ReactNode, type ElementType } from "react";

type Token = { type: "text" | "bold" | "italic" | "strike" | "code" | "link"; value: string; href?: string };

function inlineTokens(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\*\*([\s\S]+?)\*\*|~~([\s\S]+?)~~|\*([^*\n]+)\*|_([^_\n]+)_|`([^`\n]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ type: "text", value: source.slice(cursor, index) });
    if (match[1]) tokens.push({ type: "bold", value: match[1] });
    else if (match[2]) tokens.push({ type: "strike", value: match[2] });
    else if (match[3] || match[4]) tokens.push({ type: "italic", value: match[3] || match[4] });
    else if (match[5]) tokens.push({ type: "code", value: match[5] });
    else if (match[6]) tokens.push({ type: "link", value: match[6], href: match[7] });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) tokens.push({ type: "text", value: source.slice(cursor) });
  return tokens;
}

function Inline({ text }: { text: string }) {
  return <>{inlineTokens(text).map((token, index) => {
    const key = index;
    if (token.type === "bold") return <strong key={key}>{token.value}</strong>;
    if (token.type === "italic") return <em key={key}>{token.value}</em>;
    if (token.type === "strike") return <del key={key}>{token.value}</del>;
    if (token.type === "code") return <code className="md-inline-code" key={key}>{token.value}</code>;
    if (token.type === "link") return <a key={key} href={token.href} target="_blank" rel="noopener noreferrer">{token.value}</a>;
    return <Fragment key={key}>{token.value}</Fragment>;
  })}</>;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <span>{language || "código"}</span>
        <button type="button" onClick={copy}>{copied ? "Copiado!" : "Copiar código"}</button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function isTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

export default function MarkdownMessage({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = /^\s*```\s*([\w+#.-]*)\s*$/.exec(line);
    if (fence) {
      const language = fence[1] || "";
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) codeLines.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push(<CodeBlock key={key++} language={language} code={codeLines.join("\n")} />);
      continue;
    }

    if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) {
      blocks.push(<hr className="md-divider" key={key++} />);
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = (`h${level}`) as ElementType;
      blocks.push(<Tag className={`md-heading md-h${level}`} key={key++}><Inline text={heading[2]} /></Tag>);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote className="md-quote" key={key++}><Inline text={quote.join(" ")} /></blockquote>);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, ""));
      blocks.push(<ul className="md-list" key={key++}>{items.map((item, index) => <li key={index}><Inline text={item} /></li>)}</ul>);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(<ol className="md-list" key={key++}>{items.map((item, index) => <li key={index}><Inline text={item} /></li>)}</ol>);
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const parseCells = (value: string) => value.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
      const headers = parseCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(parseCells(lines[i++]));
      blocks.push(
        <div className="md-table-wrap" key={key++}>
          <table className="md-table">
            <thead><tr>{headers.map((cell, index) => <th key={index}><Inline text={cell} /></th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, colIndex) => <td key={colIndex}><Inline text={row[colIndex] || ""} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    const paragraph: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*(---+|___+|\*\*\*+)\s*$/.test(lines[i])) {
      paragraph.push(lines[i++]);
    }
    blocks.push(<p className="md-paragraph" key={key++}><Inline text={paragraph.join(" ")} /></p>);
  }

  return <div className="markdown-message">{blocks}</div>;
}
