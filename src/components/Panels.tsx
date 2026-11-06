import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { ParamValue, ProjectConfig, Timeline } from "../engine/types";
import type { Player } from "../engine/audio";
import { INSTRUMENTS } from "../engine/audio";
import { MELODIES, KEY_ROOTS, getMelody, parseNotes, parseLyrics } from "../engine/music";
import { SCENES, getScene } from "../engine/scenes";
import { PALETTES } from "../engine/palettes";
import { defaultParams, normalizeConfig, parseImport, stringifyConfig } from "../engine/config";
import { exportMp4, pickRecorderFormat, recordRealtime, supportsOfflineExport, type ExportInfo, type RecordResult } from "../engine/recorder";
import { renderFrame, sizeFor } from "../engine/render";
import { downloadBlob } from "../engine/zip";
import { Btn, Field, Section, Segmented, Select, Slider, Toggle, Warn, inputCls } from "./ui";

type Set = (fn: (c: ProjectConfig) => ProjectConfig) => void;

const safeName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) || "video-kit";

// ---------------------------------------------------------------- 音乐
export function MusicPanel({ cfg, setCfg, tl, warnings }: { cfg: ProjectConfig; setCfg: Set; tl: Timeline; warnings: string[] }) {
  const m = cfg.music;
  const mel = getMelody(m.preset);
  const lyr = parseLyrics(cfg.lyrics);
  const parsed = useMemo(() => parseNotes(m.notes, m.keyRoot), [m.notes, m.keyRoot]);
  const setMusic = (p: Partial<ProjectConfig["music"]>) => setCfg((c) => ({ ...c, music: { ...c.music, ...p } }));
  const pickMelody = (id: string) => {
    if (id === "custom") return setMusic({ preset: "custom" });
    const n = getMelody(id)!;
    setCfg((c) => {
      const old = getMelody(c.music.preset);
      const keepTitle = c.text.title && c.text.title !== old?.name;
      return {
        ...c,
        music: { ...c.music, preset: id, notes: n.notes, bpm: n.bpm, keyRoot: "C", transpose: 0 },
        lyrics: n.lyrics,
        text: keepTitle ? c.text : { ...c.text, title: n.name, subtitle: n.credit },
      };
    });
  };
  return (
    <div className="space-y-5">
      <Section title="旋律">
        <Select
          value={mel ? m.preset : "custom"}
          onChange={pickMelody}
          options={[...MELODIES.map((x) => ({ value: x.id, label: x.name })), { value: "custom", label: "自定义（自己写谱）" }]}
        />
        <div className="text-[11px] text-slate-500">{mel ? mel.credit : "自定义乐谱：请只使用公版或原创旋律，勿用现代流行歌曲旋律。"}</div>
        <Slider label="速度 BPM" value={m.bpm} min={40} max={220} onChange={(v) => setMusic({ bpm: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Slider label="移调（半音）" value={m.transpose} min={-12} max={12} onChange={(v) => setMusic({ transpose: v })} />
          <Slider label="重复次数" value={m.repeat} min={1} max={4} onChange={(v) => setMusic({ repeat: v })} />
        </div>
      </Section>

      <Section title="音色与音量">
        <Segmented value={m.instrument} options={INSTRUMENTS} onChange={(v) => setMusic({ instrument: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Slider label="音量" value={m.volume} min={0} max={1} step={0.05} onChange={(v) => setMusic({ volume: v })} />
          <Slider label="尾音" value={m.tail} min={0} max={6} step={0.5} unit="s" onChange={(v) => setMusic({ tail: v })} />
        </div>
      </Section>

      <Section title="乐谱" aside={<span className="text-[11px] text-slate-500">{parsed.items.filter((i) => i.midi !== null).length} 个音</span>}>
        <textarea
          value={m.notes}
          onChange={(e) => setMusic({ notes: e.target.value, preset: mel ? "custom" : m.preset })}
          rows={5}
          spellCheck={false}
          className={inputCls + " font-mono text-xs leading-relaxed"}
          placeholder="C4 D4 E4:2 R:1 | 或简谱：1 2 3 5 6' 0 -"
        />
        <Warn items={[...parsed.errors.slice(0, 4), ...warnings.filter((w) => !parsed.errors.some((e) => w === e))]} />
        <Field label="简谱的 1 = ">
          <Select value={m.keyRoot} onChange={(v) => setMusic({ keyRoot: v })} options={KEY_ROOTS.map((k) => ({ value: k, label: `${k} 调` }))} />
        </Field>
        <details className="rounded-lg bg-white/5 p-2.5 text-[11px] leading-relaxed text-slate-400">
          <summary className="cursor-pointer text-slate-300">写谱格式（点开）</summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            <li>音名：<code className="text-amber-200">C4 D4 F#4 Bb3</code>，C4 = 中央 C</li>
            <li>时值：冒号后写拍数，<code className="text-amber-200">E4:2</code> 两拍，<code className="text-amber-200">E4:0.5</code> 半拍，默认 1 拍</li>
            <li>休止：<code className="text-amber-200">R:1</code> 或 <code className="text-amber-200">0:1</code></li>
            <li>简谱：<code className="text-amber-200">1 2 3 4 5 6 7</code>，高八度 <code className="text-amber-200">1'</code>，低八度 <code className="text-amber-200">5,</code>，升降 <code className="text-amber-200">#4 b7</code>，延音 <code className="text-amber-200">-</code></li>
            <li>竖线 <code className="text-amber-200">|</code> 只是分小节，会被忽略</li>
          </ul>
        </details>
      </Section>

      <Section title="歌词 / 文字" aside={<span className="text-[11px] text-slate-500">{lyr.length} 字 / {tl.events.length} 音</span>}>
        <textarea
          value={cfg.lyrics}
          onChange={(e) => setCfg((c) => ({ ...c, lyrics: e.target.value }))}
          rows={3}
          className={inputCls + " leading-relaxed"}
          placeholder="一音一字（中文）；英文用空格分词。留空则不显示。"
        />
        {lyr.length > tl.events.length / Math.max(1, m.repeat) && lyr.length > 0 && <Warn items={["歌词比音符多，多出的字不会显示"]} />}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- 玩法
export function ScenePanel({ cfg, setCfg }: { cfg: ProjectConfig; setCfg: Set }) {
  const scene = getScene(cfg.scene.type);
  const setParam = (k: string, v: ParamValue) => setCfg((c) => ({ ...c, scene: { ...c.scene, params: { ...c.scene.params, [k]: v } } }));
  return (
    <div className="space-y-5">
      <Section title="选择玩法">
        <div className="grid gap-2">
          {SCENES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCfg((c) => ({ ...c, scene: { ...c.scene, type: s.id, params: defaultParams(s.id) } }))}
              className={`rounded-xl border p-3 text-left transition ${
                s.id === scene.id ? "border-violet-400/60 bg-violet-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">{s.name}</span>
                <span className="font-mono text-[10px] text-slate-500">{s.id}</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-400">{s.tagline}</div>
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">{scene.desc}</p>
      </Section>
      <Section
        title={`${scene.name} · 参数`}
        aside={
          <button className="text-[11px] text-violet-300 hover:underline" onClick={() => setCfg((c) => ({ ...c, scene: { ...c.scene, params: defaultParams(c.scene.type) } }))}>
            恢复默认
          </button>
        }
      >
        <div className="space-y-3.5">
          {scene.params
            .filter((d) => d.type === "number")
            .map((d) => (
              <Slider
                key={d.key}
                label={d.label}
                min={d.min ?? 0}
                max={d.max ?? 1}
                step={d.step ?? 0.1}
                hint={d.hint}
                value={Number(cfg.scene.params[d.key] ?? d.default)}
                onChange={(v) => setParam(d.key, v)}
              />
            ))}
          <div className="grid grid-cols-2 gap-2">
            {scene.params
              .filter((d) => d.type === "boolean")
              .map((d) => (
                <Toggle key={d.key} label={d.label} checked={Boolean(cfg.scene.params[d.key] ?? d.default)} onChange={(v) => setParam(d.key, v)} />
              ))}
          </div>
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- 画面
export function LookPanel({ cfg, setCfg }: { cfg: ProjectConfig; setCfg: Set }) {
  return (
    <div className="space-y-5">
      <Section title="配色">
        <div className="grid grid-cols-2 gap-2">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setCfg((c) => ({ ...c, scene: { ...c.scene, palette: p.id } }))}
              className={`overflow-hidden rounded-xl border text-left transition ${cfg.scene.palette === p.id ? "border-violet-400" : "border-white/10 hover:border-white/30"}`}
            >
              <div className="h-10" style={{ background: `linear-gradient(135deg, ${p.bg[0]}, ${p.bg[1]})` }}>
                <div className="flex h-full items-center gap-1.5 px-2">
                  {[0, 4, 8].map((k) => (
                    <span key={k} className="h-3 w-3 rounded-full" style={{ background: `hsl(${(p.hue0 + (k / 12) * p.span) % 360} ${p.sat}% ${p.light}%)` }} />
                  ))}
                  <span className="ml-auto h-3 w-3 rounded-full" style={{ background: p.accent }} />
                </div>
              </div>
              <div className="flex justify-between bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                <span>{p.name}</span>
                <span className="font-mono text-slate-600">{p.id}</span>
              </div>
            </button>
          ))}
        </div>
      </Section>
      <Section title="画幅与帧率">
        <Segmented
          value={cfg.canvas.aspect}
          options={[
            { value: "9:16", label: "竖屏 9:16" },
            { value: "16:9", label: "横屏 16:9" },
            { value: "1:1", label: "方形 1:1" },
          ]}
          onChange={(v) => setCfg((c) => ({ ...c, canvas: { ...c.canvas, aspect: v } }))}
        />
        <Segmented
          value={cfg.canvas.fps}
          options={[
            { value: 30, label: "30 fps" },
            { value: 60, label: "60 fps" },
          ]}
          onChange={(v) => setCfg((c) => ({ ...c, canvas: { ...c.canvas, fps: v } }))}
        />
      </Section>
      <Section title="标题文字">
        <Field label="标题">
          <input className={inputCls} value={cfg.text.title} maxLength={60} onChange={(e) => setCfg((c) => ({ ...c, text: { ...c.text, title: e.target.value } }))} />
        </Field>
        <Field label="副标题">
          <input className={inputCls} value={cfg.text.subtitle} maxLength={80} onChange={(e) => setCfg((c) => ({ ...c, text: { ...c.text, subtitle: e.target.value } }))} />
        </Field>
        <Toggle label="画面里显示标题" checked={cfg.text.show} onChange={(v) => setCfg((c) => ({ ...c, text: { ...c.text, show: v } }))} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- 导出
export function ExportPanel({
  cfg,
  tl,
  player,
  tRef,
  exporting,
  setExporting,
}: {
  cfg: ProjectConfig;
  tl: Timeline;
  player: Player;
  tRef: MutableRefObject<number>;
  exporting: boolean;
  setExporting: (b: boolean) => void;
}) {
  const [edge, setEdge] = useState(1280);
  const [prog, setProg] = useState(0);
  const [err, setErr] = useState("");
  const [stage, setStage] = useState("");
  const [res, setRes] = useState<{ url: string; r: RecordResult; info?: ExportInfo } | null>(null);
  const abort = useRef(false);
  const offline = useMemo(() => supportsOfflineExport(), []);
  const fmt = useMemo(() => (offline ? { ext: "mp4" as const } : pickRecorderFormat()), [offline]);
  const { w, h } = sizeFor(cfg.canvas.aspect, edge);
  useEffect(
    () => () => {
      if (res) URL.revokeObjectURL(res.url);
    },
    [res],
  );

  const start = async () => {
    setErr("");
    setRes(null);
    abort.current = false;
    setExporting(true);
    setProg(0);
    try {
      player.stop();
      if (offline) {
        const r = await exportMp4({
          cfg,
          tl,
          w,
          h,
          onProgress: (p, st) => {
            setProg(p);
            setStage(st);
          },
          aborted: () => abort.current,
        });
        setRes({ url: URL.createObjectURL(r.blob), r, info: r.info });
      } else {
        setStage("实时录制");
        const r = await recordRealtime({ cfg, tl, player, w, h, onProgress: setProg, aborted: () => abort.current });
        setRes({ url: URL.createObjectURL(r.blob), r });
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setExporting(false);
    }
  };
  const cover = () => {
    const cv = document.createElement("canvas");
    const s = sizeFor(cfg.canvas.aspect, 1920);
    cv.width = s.w;
    cv.height = s.h;
    const t = tRef.current > 0.5 ? tRef.current : (tl.events[3]?.t ?? 1.5);
    renderFrame(cv.getContext("2d")!, s.w, s.h, t, tl, cfg);
    cv.toBlob((b) => b && downloadBlob(b, `${safeName(cfg.name)}-cover.png`), "image/png");
  };

  return (
    <div className="space-y-5">
      <Section title={offline ? "视频导出（MP4 · 逐帧渲染）" : "视频导出（浏览器录制）"}>
        {offline ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-slate-400">
            <strong className="text-slate-200">逐帧离线渲染</strong>：画面按固定帧率一帧一帧算出来，声音单独合成再对齐，编码为标准 <strong className="text-slate-200">MP4（H.264 + AAC）</strong>。
            不受卡顿影响、音画严格同步，导出期间不会发声。时长 {tl.duration.toFixed(1)} 秒，导出完成后可先在下方预览再下载。
          </div>
        ) : (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-[11px] leading-relaxed text-amber-200/80">
            当前浏览器不支持 WebCodecs，只能退回<strong>实时录屏</strong>（时长 {tl.duration.toFixed(1)} 秒，需保持页面在前台）。音画同步与兼容性较差，强烈建议改用电脑版 Chrome / Edge。
          </div>
        )}
        <Field label="分辨率">
          <Segmented
            value={edge}
            options={[
              { value: 960, label: "标清" },
              { value: 1280, label: "高清" },
              { value: 1920, label: "全高清" },
            ]}
            onChange={setEdge}
          />
          <div className="mt-1 text-[11px] text-slate-500">
            输出 {w}×{h} · {cfg.canvas.fps}fps · 格式 {fmt ? fmt.ext.toUpperCase() : "不支持"}
          </div>
        </Field>
        {!fmt && <Warn items={["当前浏览器不支持录制。请用 Chrome / Edge（桌面或新版安卓）。你仍可导出 JSON 与封面。"]} />}
        {exporting ? (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all" style={{ width: `${(prog * 100).toFixed(1)}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>{stage || "处理中"}… {(prog * 100).toFixed(0)}%</span>
              <Btn variant="danger" onClick={() => (abort.current = true)}>取消</Btn>
            </div>
          </div>
        ) : (
          <Btn variant="primary" disabled={!fmt} onClick={start} className="w-full py-3 text-sm">
            {offline ? "● 渲染并导出 MP4" : "● 开始录制并导出"}
          </Btn>
        )}
        {err && <Warn items={[err]} />}
        {res && (
          <div className="space-y-2 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3">
            <div className="text-xs text-emerald-200">
              ✓ 导出完成 · {res.r.ext.toUpperCase()} · {(res.r.blob.size / 1048576).toFixed(1)} MB
            </div>
            {res.info && (
              <div className="text-[11px] leading-relaxed text-slate-400">
                已自检：画面 {res.info.videoCodec} + 声音 {res.info.audioCodec} 两条轨道齐全 · {res.info.w}×{res.info.h} · {res.info.fps}fps · {res.info.frames} 帧 · 时长 {res.info.duration.toFixed(2)} 秒
              </div>
            )}
            <video src={res.url} controls playsInline className="mx-auto max-h-80 rounded-lg bg-black" />
            <Btn variant="primary" className="w-full" onClick={() => downloadBlob(res.r.blob, `${safeName(cfg.name)}.${res.r.ext}`)}>
              下载视频文件
            </Btn>
            {res.r.ext === "webm" && <div className="text-[11px] text-slate-500">这是 WebM。手机相册可能不识别，可用剪映/格式工厂转 MP4，或换 Chrome 新版（支持直接导出 MP4）。</div>}
          </div>
        )}
      </Section>
      <Section title="其他导出">
        <div className="grid grid-cols-2 gap-2">
          <Btn onClick={cover}>封面 PNG（当前画面）</Btn>
          <Btn onClick={() => downloadBlob(new Blob([stringifyConfig(cfg)], { type: "application/json" }), `${safeName(cfg.name)}.json`)}>配置 JSON</Btn>
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- JSON
export function JsonPanel({ cfg, setCfg, onToast }: { cfg: ProjectConfig; setCfg: Set; onToast: (s: string) => void }) {
  const text = useMemo(() => stringifyConfig(cfg), [cfg]);
  const [draft, setDraft] = useState(text);
  const [dirty, setDirty] = useState(false);
  const [msgs, setMsgs] = useState<string[]>([]);
  const [bad, setBad] = useState("");
  useEffect(() => {
    if (!dirty) setDraft(text);
  }, [text, dirty]);

  const apply = () => {
    try {
      const { configs, warnings } = parseImport(draft);
      setCfg(() => configs[0]);
      setMsgs(warnings);
      setBad("");
      setDirty(false);
      onToast(warnings.length ? `已应用（${warnings.length} 条提示）` : "配置已应用");
    } catch (e) {
      setBad((e as Error).message);
    }
  };
  // 预检：不改动配置，仅提示
  const check = useMemo(() => {
    if (!dirty) return [] as string[];
    try {
      return normalizeConfig(JSON.parse(draft)).warnings;
    } catch (e) {
      return ["JSON 语法错误：" + (e as Error).message];
    }
  }, [draft, dirty]);

  return (
    <div className="space-y-4">
      <div className="text-[11px] leading-relaxed text-slate-400">
        这是当前作品的完整配置。工作台上的所有操作都只是在改这份 JSON；你也可以直接在这里改，点「应用」生效。缺的字段会自动补默认值。
      </div>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
        rows={18}
        spellCheck={false}
        className={inputCls + " font-mono text-[11px] leading-relaxed"}
      />
      {bad && <Warn items={[bad]} />}
      <Warn items={dirty ? check : msgs} />
      <div className="flex flex-wrap gap-2">
        <Btn variant="primary" disabled={!dirty} onClick={apply}>应用修改</Btn>
        <Btn disabled={!dirty} onClick={() => { setDraft(text); setDirty(false); setBad(""); }}>放弃</Btn>
        <Btn onClick={() => { void navigator.clipboard?.writeText(text); onToast("已复制 JSON"); }}>复制</Btn>
        <Btn onClick={() => downloadBlob(new Blob([text], { type: "application/json" }), `${safeName(cfg.name)}.json`)}>下载 .json</Btn>
      </div>
    </div>
  );
}
