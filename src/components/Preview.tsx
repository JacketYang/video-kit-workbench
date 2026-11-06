import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as RPE } from "react";
import type { ProjectConfig, Timeline } from "../engine/types";
import type { Player } from "../engine/audio";
import { renderFrame, sizeFor } from "../engine/render";
import { getPalette } from "../engine/palettes";
import { noteHsl, hsl } from "../engine/util";

const PREVIEW_EDGE = 900;
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d={d} />
    </svg>
  );
}

export function Preview({
  cfg,
  tl,
  player,
  tRef,
  exporting,
}: {
  cfg: ProjectConfig;
  tl: Timeline;
  player: Player;
  tRef: MutableRefObject<number>;
  exporting: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rollRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loopOn, setLoopOn] = useState(true);
  const [muted, setMuted] = useState(false);
  const [t, setT] = useState(0);
  const dirty = useRef(true);
  const latest = useRef({ cfg, tl, loopOn, playing });
  latest.current = { cfg, tl, loopOn, playing };
  const size = useMemo(() => sizeFor(cfg.canvas.aspect, PREVIEW_EDGE), [cfg.canvas.aspect]);

  const startAudio = useCallback(
    (from: number) => {
      const { cfg: c, tl: l } = latest.current;
      return player.start(l, from, c.music.instrument, c.music.volume);
    },
    [player],
  );

  const seek = useCallback(
    (to: number) => {
      const nt = Math.max(0, Math.min(latest.current.tl.duration, to));
      tRef.current = nt;
      setT(nt);
      dirty.current = true;
      if (latest.current.playing) void startAudio(nt);
    },
    [startAudio, tRef],
  );

  const pause = useCallback(() => {
    player.stop();
    setPlaying(false);
  }, [player]);

  const toggle = useCallback(async () => {
    if (latest.current.playing) return pause();
    let from = tRef.current;
    if (from >= latest.current.tl.duration - 0.05) from = 0;
    tRef.current = from;
    await startAudio(from);
    setPlaying(true);
  }, [pause, startAudio, tRef]);

  // 导出时让出播放器
  useEffect(() => {
    if (exporting) pause();
  }, [exporting, pause]);

  // 配置变化：重画；正在播放则从当前时间点重排声音
  useEffect(() => {
    dirty.current = true;
  }, [cfg]);
  // 只有乐谱/音色/音量变化才重排声音，拖画面参数不会打断播放
  const audioKey = `${cfg.music.instrument}|${cfg.music.volume}`;
  useEffect(() => {
    if (tRef.current > tl.duration) tRef.current = tl.duration;
    if (latest.current.playing) void startAudio(tRef.current);
    dirty.current = true;
  }, [tl, audioKey, startAudio, tRef]);

  useEffect(() => {
    dirty.current = true;
  }, [size]);

  // 主循环
  useEffect(() => {
    let id = 0;
    let lastUi = 0;
    const tick = (now: number) => {
      const L = latest.current;
      if (L.playing) {
        let nt = player.now();
        if (nt >= L.tl.duration) {
          if (L.loopOn) {
            nt = 0;
            void startAudio(0);
          } else {
            nt = L.tl.duration;
            player.stop();
            setPlaying(false);
          }
        }
        tRef.current = nt;
        dirty.current = true;
      }
      const cv = canvasRef.current;
      if (cv && dirty.current) {
        dirty.current = false;
        const ctx = cv.getContext("2d");
        if (ctx) renderFrame(ctx, cv.width, cv.height, tRef.current, L.tl, L.cfg);
        if (now - lastUi > 50) {
          lastUi = now;
          setT(tRef.current);
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [player, startAudio, tRef]);

  useEffect(() => () => player.stop(), [player]);

  // 迷你音符条
  useEffect(() => {
    const cv = rollRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.fillRect(0, 0, W, H);
    const pal = getPalette(cfg.scene.palette);
    const range = Math.max(1, tl.maxMidi - tl.minMidi);
    for (const e of tl.events) {
      const x = (e.t / tl.duration) * W;
      const y = H - 8 - ((e.midi - tl.minMidi) / range) * (H - 16);
      ctx.fillStyle = hsl(noteHsl(pal, e.midi), 0, e.t < t ? 0.45 : 1);
      ctx.fillRect(x, y - 3, Math.max(3, (e.dur / tl.duration) * W * 0.85), 6);
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect((t / tl.duration) * W - 1, 0, 2, H);
  }, [tl, cfg.scene.palette, t]);

  const onRoll = (e: RPE<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * tl.duration);
  };

  const portrait = size.h > size.w;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center rounded-2xl border border-white/10 bg-black/40 p-3">
        <canvas
          ref={canvasRef}
          width={size.w}
          height={size.h}
          onClick={() => void toggle()}
          className="cursor-pointer rounded-lg bg-black shadow-2xl"
          style={
            portrait
              ? { height: "min(64vh, 640px)", aspectRatio: `${size.w}/${size.h}`, maxWidth: "100%" }
              : { width: "100%", maxWidth: 760, aspectRatio: `${size.w}/${size.h}` }
          }
        />
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#12151d] p-2">
        <button
          type="button"
          disabled={exporting}
          onClick={() => void toggle()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg disabled:opacity-40"
          aria-label={playing ? "暂停" : "播放"}
        >
          {playing ? <Icon d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <Icon d="M8 5v14l11-7z" />}
        </button>
        <button type="button" onClick={() => seek(0)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10" aria-label="回到开头">
          <Icon d="M6 6h2v12H6zM9.5 12 18 6v12z" />
        </button>
        <div className="min-w-[92px] font-mono text-xs text-slate-300">
          {fmt(t)} <span className="text-slate-600">/ {fmt(tl.duration)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={tl.duration}
          step={0.01}
          value={Math.min(t, tl.duration)}
          onChange={(e) => seek(Number(e.target.value))}
          className="vk-range min-w-0 flex-1"
          aria-label="进度"
        />
        <button
          type="button"
          onClick={() => setLoopOn((v) => !v)}
          className={`rounded-lg px-2 py-1.5 text-[11px] ${loopOn ? "bg-violet-500/20 text-violet-200" : "text-slate-500 hover:bg-white/10"}`}
        >
          循环
        </button>
        <button
          type="button"
          onClick={() => {
            player.setMuted(!muted);
            setMuted(!muted);
          }}
          className={`rounded-lg px-2 py-1.5 text-[11px] ${muted ? "bg-red-500/20 text-red-200" : "text-slate-300 hover:bg-white/10"}`}
        >
          {muted ? "静音" : "声音"}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#12151d] p-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
          <span>音符轨道 · 点击跳转</span>
          <span>
            {tl.events.length} 个音符 · {fmt(tl.duration)} · {cfg.canvas.aspect} · {cfg.canvas.fps}fps
          </span>
        </div>
        <canvas ref={rollRef} width={800} height={64} onPointerDown={onRoll} className="h-12 w-full cursor-pointer rounded-md" />
      </div>
    </div>
  );
}
