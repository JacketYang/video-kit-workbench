import { useCallback, useRef, useState } from "react";
import { useProjects } from "./store";
import { Player } from "./engine/audio";
import { parseImport, stringifyConfig } from "./engine/config";
import { downloadBlob } from "./engine/zip";
import { Workbench } from "./components/Workbench";
import { Library } from "./components/Library";
import { Docs } from "./components/Docs";
import { Handoff } from "./components/Handoff";
import { cn } from "./utils/cn";

type View = "bench" | "library" | "docs" | "handoff";
const NAV: { id: View; label: string; icon: string }[] = [
  { id: "bench", label: "工作台", icon: "M4 5h16v10H4zM8 19h8M12 15v4" },
  { id: "library", label: "作品·模板", icon: "M3 7h6l2 2h10v10H3z" },
  { id: "docs", label: "配置说明", icon: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6" },
  { id: "handoff", label: "交接", icon: "M12 3v12m0 0-4-4m4 4 4-4M5 19h14" },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function App() {
  const [view, setView] = useState<View>("bench");
  const { projects, cur, setCfg, create, remove, duplicate, open } = useProjects();
  const player = useRef(new Player()).current;
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState("");
  const toastT = useRef(0);
  const notify = useCallback((s: string) => {
    setToast(s);
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(""), 3200);
  }, []);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const { configs, warnings } = parseImport(await f.text());
      configs.forEach((c) => create(c));
      setView("bench");
      notify(`已导入 ${configs.length} 个作品${warnings.length ? `（${warnings.length} 条提示：${warnings[0]}）` : ""}`);
    } catch (e) {
      notify((e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex h-full min-h-screen flex-col lg:flex-row">
      {/* 桌面侧栏 */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-white/5 bg-[#0e1016] p-3 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2 pt-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg">♪</div>
          <div>
            <div className="text-sm font-bold leading-tight">video-kit</div>
            <div className="text-[10px] tracking-[0.2em] text-slate-500">MUSIC STUDIO</div>
          </div>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                view === n.id ? "bg-violet-500/15 text-violet-100" : "text-slate-400 hover:bg-white/5",
              )}
            >
              <NavIcon d={n.icon} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-slate-400">
          作品自动保存在本机。重要作品请在「作品·模板」导出 JSON，或在「交接」下载源码包。
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/5 bg-[#0b0d12]/90 px-3 py-2.5 backdrop-blur sm:px-5">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">♪</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{cur.config.name}</div>
            <div className="text-[10px] text-slate-500">自动保存 · {new Date(cur.updatedAt).toLocaleTimeString()}</div>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">
            导入配置
          </button>
          <button
            onClick={() => downloadBlob(new Blob([stringifyConfig(cur.config)], { type: "application/json" }), `${cur.config.name}.json`)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
          >
            导出配置
          </button>
        </header>

        <main className="flex-1">
          {view === "bench" && <Workbench key={cur.id} cfg={cur.config} setCfg={setCfg} player={player} onToast={notify} />}
          {view === "library" && (
            <Library
              projects={projects}
              currentId={cur.id}
              onOpen={(id) => {
                open(id);
                setView("bench");
              }}
              onCreate={(c) => {
                create(c);
                setView("bench");
                notify("已新建作品");
              }}
              onDuplicate={(id) => {
                duplicate(id);
                notify("已复制");
              }}
              onRemove={remove}
              onImportClick={() => fileRef.current?.click()}
            />
          )}
          {view === "docs" && <Docs />}
          {view === "handoff" && <Handoff />}
        </main>
      </div>

      {/* 手机底栏 */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/10 bg-[#0e1016]/95 backdrop-blur lg:hidden">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", view === n.id ? "text-violet-300" : "text-slate-500")}
          >
            <NavIcon d={n.icon} />
            {n.label}
          </button>
        ))}
      </nav>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-xl border border-white/10 bg-[#1b1f2b] px-4 py-2.5 text-xs shadow-2xl lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
