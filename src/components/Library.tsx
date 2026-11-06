import { useEffect, useMemo, useRef } from "react";
import type { ProjectConfig } from "../engine/types";
import type { Saved } from "../store";
import { TEMPLATES, makeConfig, stringifyConfig } from "../engine/config";
import { compileTimeline } from "../engine/music";
import { renderFrame, sizeFor } from "../engine/render";
import { getScene } from "../engine/scenes";
import { downloadBlob } from "../engine/zip";
import { Btn } from "./ui";

function Thumb({ cfg }: { cfg: ProjectConfig }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { tl } = useMemo(() => compileTimeline(cfg), [cfg]);
  const size = sizeFor(cfg.canvas.aspect, 420);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const e = tl.events[Math.min(5, tl.events.length - 1)];
    renderFrame(cv.getContext("2d")!, cv.width, cv.height, e ? e.t + 0.12 : 1, tl, cfg);
  }, [cfg, tl]);
  return <canvas ref={ref} width={size.w} height={size.h} className="h-full w-full rounded-lg bg-black object-cover" />;
}

function Meta({ cfg }: { cfg: ProjectConfig }) {
  const { tl } = useMemo(() => compileTimeline(cfg), [cfg]);
  return (
    <div className="text-[11px] text-slate-500">
      {getScene(cfg.scene.type).name} · {tl.events.length} 音 · {tl.duration.toFixed(0)}s · {cfg.canvas.aspect}
    </div>
  );
}

export function Library({
  projects,
  currentId,
  onOpen,
  onCreate,
  onDuplicate,
  onRemove,
  onImportClick,
}: {
  projects: Saved[];
  currentId: string;
  onOpen: (id: string) => void;
  onCreate: (c: ProjectConfig) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onImportClick: () => void;
}) {
  const card = "overflow-hidden rounded-2xl border border-white/10 bg-[#12151d]";
  const thumbBox = (c: ProjectConfig) => (
    <div className="flex items-center justify-center bg-black/40 p-2" style={{ height: 220 }}>
      <div style={{ height: "100%", aspectRatio: c.canvas.aspect === "9:16" ? "9/16" : c.canvas.aspect === "16:9" ? "16/9" : "1/1", maxWidth: "100%" }}>
        <Thumb cfg={c} />
      </div>
    </div>
  );
  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-8 p-3 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">作品与模板</h1>
          <p className="mt-1 text-xs text-slate-500">作品保存在本机浏览器里；想长期保存或换设备，请导出 JSON。</p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={onImportClick}>导入 JSON</Btn>
          <Btn variant="primary" onClick={() => onCreate(makeConfig())}>＋ 新建作品</Btn>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">我的作品 · {projects.length}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((p) => (
            <div key={p.id} className={card + (p.id === currentId ? " ring-1 ring-violet-400/60" : "")}>
              {thumbBox(p.config)}
              <div className="space-y-2 p-3">
                <div className="truncate text-sm font-semibold">
                  {p.config.name} {p.id === currentId && <span className="ml-1 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-normal text-violet-200">编辑中</span>}
                </div>
                <Meta cfg={p.config} />
                <div className="flex flex-wrap gap-1.5">
                  <Btn variant="primary" onClick={() => onOpen(p.id)}>打开</Btn>
                  <Btn onClick={() => onDuplicate(p.id)}>复制</Btn>
                  <Btn onClick={() => downloadBlob(new Blob([stringifyConfig(p.config)], { type: "application/json" }), `${p.config.name}.json`)}>JSON</Btn>
                  <Btn variant="danger" onClick={() => confirm(`删除「${p.config.name}」？`) && onRemove(p.id)}>删除</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-slate-300">模板 · presets/*.json</h2>
        <p className="mb-3 text-xs text-slate-500">每个模板就是一个很短的 JSON 文件。想要新模板：写一个 JSON 丢进 presets 文件夹即可。</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TEMPLATES.map((t) => (
            <div key={t.file} className={card}>
              {thumbBox(t.config)}
              <div className="space-y-2 p-3">
                <div className="truncate text-sm font-semibold">{t.config.name}</div>
                <Meta cfg={t.config} />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-600">{t.file}</span>
                  <Btn variant="primary" onClick={() => onCreate(t.config)}>用它新建</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
