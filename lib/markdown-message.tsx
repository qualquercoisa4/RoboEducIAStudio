"use client";

import React from "react";

function inline(text: string, keyPrefix: string): React.ReactNode[] {
 const parts: React.ReactNode[] = [];
 const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;
 let last = 0, match: RegExpExecArray | null, index = 0;
 while ((match = pattern.exec(text))) {
  if (match.index > last) parts.push(text.slice(last, match.index));
  const token = match[0], key = keyPrefix + "-" + index++;
  if (token.startsWith("`")) parts.push(<code key={key}>{token.slice(1, -1)}</code>);
  else if (token.startsWith("**")) parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
  else if (token.startsWith("*")) parts.push(<em key={key}>{token.slice(1, -1)}</em>);
  else if (token.startsWith("~~")) parts.push(<del key={key}>{token.slice(2, -2)}</del>);
  else {
   const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
   if (link && /^https?:\/\//i.test(link[2])) parts.push(<a key={key} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>);
   else parts.push(token);
  }
  last = pattern.lastIndex;
 }
 if (last < text.length) parts.push(text.slice(last));
 return parts;
}

export function MarkdownMessage({ content }: { content: string }) {
 const lines = content.replace(/\r\n?/g, "\n").split("\n");
 const blocks: React.ReactNode[] = [];
 let i = 0, key = 0;
 while (i < lines.length) {
  const line = lines[i];
  if (!line.trim()) { i++; continue; }
  if (/^\s*```/.test(line)) {
   const language = line.trim().slice(3).trim();
   const code: string[] = []; i++;
   while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
   i++;
   blocks.push(<pre key={key++} data-language={language}><code>{code.join("\n")}</code></pre>); continue;
  }
  if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { blocks.push(<hr key={key++}/>); i++; continue; }
  const heading = line.match(/^\s*(#{1,4})\s+(.+)$/);
  if (heading) {
   const level = heading[1].length, children = inline(heading[2], "h"+key);
   blocks.push(React.createElement("h"+level, {key:key++}, ...children)); i++; continue;
  }
  if (/^\s*>/.test(line)) {
   const quote: string[] = [];
   while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
   blocks.push(<blockquote key={key++}>{quote.map((v,n)=><p key={n}>{inline(v,"q"+key+n)}</p>)}</blockquote>); continue;
  }
  if (/^\s*([-*+] |\d+\. )/.test(line)) {
   const ordered = /^\s*\d+\. /.test(line), items: string[] = [];
   while (i < lines.length && /^\s*([-*+] |\d+\. )/.test(lines[i])) items.push(lines[i++].replace(/^\s*(?:[-*+] |\d+\. )/, ""));
   const Tag = ordered ? "ol" : "ul";
   blocks.push(<Tag key={key++}>{items.map((v,n)=><li key={n}>{inline(v,"li"+key+n)}</li>)}</Tag>); continue;
  }
  if (line.includes("|") && i+1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i+1])) {
   const cells=(value:string)=>value.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(v=>v.trim());
   const headers=cells(line); i+=2; const rows:string[][]=[];
   while(i<lines.length && lines[i].includes("|")) rows.push(cells(lines[i++]));
   blocks.push(<div className="studio-markdown-table-wrap" key={key++}><table><thead><tr>{headers.map((v,n)=><th key={n}>{inline(v,"th"+key+n)}</th>)}</tr></thead><tbody>{rows.map((row,n)=><tr key={n}>{headers.map((_,c)=><td key={c}>{inline(row[c]||"","td"+key+n+c)}</td>)}</tr>)}</tbody></table></div>); continue;
  }
  const paragraph: string[] = [line]; i++;
  while (i < lines.length && lines[i].trim() && !/^\s*(#{1,4} |[-*+] |\d+\. |>|\`\`\`|---\s*$)/.test(lines[i])) paragraph.push(lines[i++]);
  blocks.push(<p key={key++}>{paragraph.map((v,n)=><React.Fragment key={n}>{n>0?" ":null}{inline(v,"p"+key+n)}</React.Fragment>)}</p>);
 }
 return <div className="studio-markdown">{blocks}</div>;
}
