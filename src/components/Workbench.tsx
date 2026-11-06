import { useMemo, useRef, useState } from "react";
import type { ProjectConfig } from "../engine/types";
import type { Player } from "../engine/audio";
import { compileTimeline } from "../engine/music";
import { cn } from "../utils/cn";
import { Preview } from "./Preview";
import { ExportPanel, JsonPanel, LookPanel, MusicPanel, ScenePanel } from "./Panels";
import { inputCls } from "./ui";

const TABS = [
  { id: "music", label: "音乐" },
  { id: "scene", label: "玩法" },
  { id: "look", label: "画面" },
  { id: "export", label: "导出" },
  { id: "json", label: "配置" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function Workbench({
  cfg,
  setCfg,
  player,
  onToast,
}: {
  cfg: ProjectConfig;
  setCfg: (fn: (c: ProjectConfig) => ProjectConfig) => void;
  player: Player;
  onToast: (s: string) => void;
}) {
  const [tab, setTab] = useState<TabId>("music");
  const [exporting, setExporting] = useState(false);
  const tRef = useRef(0);
  const { tl, warnings } = useMemo(() => compileTimeline(cfg), [cfg.music, cfg.lyrics]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto grid w-full max-w-[1280px] gap-5 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-3">
        <input
          value={cfg.name}
          maxLength={60}
          onChange={(e) => setCfg((c) => ({ ...c, name: e.target.value }))}
          className={cn(inputCls, "border-transparent bg-transparent px-1 text-lg font-semibold hover:border-white/10")}
          aria-label="作品名称"
        />
        <Preview cfg={cfg} tl={tl} player={player} tRef={tRef} exporting={exporting} />
      </div>

      <div className="min-w-0 self-start rounded-2xl border border-white/10 bg-[#12151d] lg:sticky lg:top-[72px]">
        <div className="flex gap-1 border-b border-white/5 p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 rounded-lg px-2 py-2 text-xs font-medium transition",
                tab === t.id ? "bg-violet-500/20 text-violet-100" : "text-slate-400 hover:bg-white/5",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={cn("p-4 lg:max-h-[calc(100vh-150px)] lg:overflow-y-auto", exporting && tab !== "export" && "pointer-events-none opacity-50")}>
          {tab === "music" && <MusicPanel cfg={cfg} setCfg={setCfg} tl={tl} warnings={warnings} />}
          {tab === "scene" && <ScenePanel cfg={cfg} setCfg={setCfg} />}
          {tab === "look" && <LookPanel cfg={cfg} setCfg={setCfg} />}
          {tab === "export" && <ExportPanel cfg={cfg} tl={tl} player={player} tRef={tRef} exporting={exporting} setExporting={setExporting} />}
          {tab === "json" && <JsonPanel cfg={cfg} setCfg={setCfg} onToast={onToast} />}
        </div>
      </div>
    </div>
  );
}
