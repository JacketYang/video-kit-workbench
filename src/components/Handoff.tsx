import { useState } from "react";
import { DOC_HANDOFF, DOC_NEXT, SOURCE_FILES, buildSourceZip } from "../engine/sources";
import { downloadBlob } from "../engine/zip";
import { Btn } from "./ui";
import { Markdown } from "./Markdown";

export function Handoff() {
  const [tab, setTab] = useState<"handoff" | "next" | "files">("handoff");
  const total = SOURCE_FILES.reduce((s, f) => s + f.data.length, 0);
  const tabCls = (on: boolean) => `rounded-lg px-3 py-2 text-xs ${on ? "bg-violet-500/20 text-violet-100" : "text-slate-400 hover:bg-white/5"}`;
  return (
    <div className="mx-auto w-full max-w-[920px] space-y-5 p-3 sm:p-6">
      <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 p-4">
        <h1 className="text-lg font-bold">交接包 · 一键下载，不用敲任何命令</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          下面的 ZIP 由本页面当场打包，里面就是整个项目源码（{SOURCE_FILES.length} 个文件，约 {(total / 1024).toFixed(0)} KB）。解压后整个文件夹上传到你的 GitHub 仓库即可；下次对话把仓库地址和 HANDOFF.md 发给我。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="primary" onClick={() => downloadBlob(buildSourceZip(), "video-kit-workbench-source.zip")}>⬇ 下载完整源码 ZIP</Btn>
          <Btn onClick={() => downloadBlob(new Blob([DOC_HANDOFF], { type: "text/markdown" }), "HANDOFF.md")}>只下载 HANDOFF.md</Btn>
          <Btn onClick={() => downloadBlob(new Blob([DOC_NEXT], { type: "text/markdown" }), "NEXT_SESSION.md")}>只下载 NEXT_SESSION.md</Btn>
        </div>
      </div>

      <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-relaxed text-amber-100/90">
        <div className="mb-1 font-semibold">上传 GitHub 的最小做法（手机/电脑网页都行）</div>
        <ol className="list-decimal space-y-0.5 pl-5">
          <li>解压 ZIP，得到文件夹 <code className="text-amber-200">video-kit-workbench</code>。</li>
          <li>打开 github.com → 你的仓库 → Add file → Upload files，把文件夹里的<strong>全部内容</strong>拖进去（保持 src、presets 目录结构）。</li>
          <li>Commit changes。完成。<strong>不需要 node_modules、dist、package-lock.json</strong>。</li>
          <li>如果只想传最少：<code className="text-amber-200">HANDOFF.md、NEXT_SESSION.md、presets/、src/</code>、<code className="text-amber-200">package.json、index.html、vite.config.ts、tsconfig.json</code>。</li>
          <li>本工具不会、也不应该把任何 API key 写进仓库。</li>
        </ol>
      </div>

      <div className="flex gap-1 rounded-xl border border-white/10 bg-[#12151d] p-1.5">
        <button className={tabCls(tab === "handoff")} onClick={() => setTab("handoff")}>HANDOFF.md</button>
        <button className={tabCls(tab === "next")} onClick={() => setTab("next")}>NEXT_SESSION.md</button>
        <button className={tabCls(tab === "files")} onClick={() => setTab("files")}>文件清单</button>
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#12151d] p-4 sm:p-6">
        {tab === "handoff" && <Markdown text={DOC_HANDOFF} />}
        {tab === "next" && <Markdown text={DOC_NEXT} />}
        {tab === "files" && (
          <table className="w-full text-xs">
            <tbody>
              {SOURCE_FILES.map((f) => (
                <tr key={f.path} className="border-b border-white/5">
                  <td className="py-1.5 font-mono text-slate-300">{f.path}</td>
                  <td className="py-1.5 text-right text-slate-500">{(f.data.length / 1024).toFixed(1)} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
