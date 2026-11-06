import type { ReactNode } from "react";

// 极简 Markdown 渲染：标题 / 列表 / 代码块 / 表格 / 行内代码与粗体。够读交接文档用。
function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    out.push(tok.startsWith("`") ? <code key={k++}>{tok.slice(1, -1)}</code> : <strong key={k++}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const els: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      els.push(
        <pre key={key++}>
          <code>{buf.join("\n")}</code>
        </pre>,
      );
    } else if (/^#{1,3}\s/.test(l)) {
      const lv = l.match(/^#+/)![0].length;
      const c = inline(l.replace(/^#+\s*/, ""));
      els.push(lv === 1 ? <h1 key={key++}>{c}</h1> : lv === 2 ? <h2 key={key++}>{c}</h2> : <h3 key={key++}>{c}</h3>);
      i++;
    } else if (/^\s*[-*]\s/.test(l)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) items.push(<li key={i}>{inline(lines[i++].replace(/^\s*[-*]\s/, ""))}</li>);
      els.push(<ul key={key++}>{items}</ul>);
    } else if (/^\d+\.\s/.test(l)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) items.push(<li key={i}>{inline(lines[i++].replace(/^\d+\.\s/, ""))}</li>);
      els.push(<ol key={key++}>{items}</ol>);
    } else if (l.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[\s:|-]+\|?$/.test(lines[i])) rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      els.push(
        <div key={key++} className="overflow-x-auto">
          <table>
            <thead>
              <tr>{rows[0].map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, a) => (
                <tr key={a}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (l.trim() === "") {
      i++;
    } else {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3}\s|```|\s*[-*]\s|\d+\.\s|\|)/.test(lines[i])) buf.push(lines[i++]);
      els.push(<p key={key++}>{inline(buf.join(" "))}</p>);
    }
  }
  return <div className="vk-prose">{els}</div>;
}
