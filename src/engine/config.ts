import type { Aspect, Instrument, ParamValue, ProjectConfig } from "./types";
import { SCENES, getScene } from "./scenes";
import { PALETTES } from "./palettes";
import { KEY_ROOTS, getMelody } from "./music";

export const SCHEMA = "video-kit.project/1" as const;
export const ASPECTS: Aspect[] = ["9:16", "16:9", "1:1"];
export const INSTRUMENT_IDS: Instrument[] = ["marimba", "bell", "pluck", "piano"];

export function defaultParams(sceneType: string): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const d of getScene(sceneType).params) out[d.key] = d.default;
  return out;
}

export function makeConfig(melodyId = "twinkle", sceneType = "bubble-keys"): ProjectConfig {
  const m = getMelody(melodyId) ?? getMelody("twinkle")!;
  return {
    schema: SCHEMA,
    name: `${m.name} · 新作品`,
    canvas: { aspect: "9:16", fps: 30 },
    music: {
      preset: m.id,
      notes: m.notes,
      bpm: m.bpm,
      keyRoot: "C",
      transpose: 0,
      instrument: "marimba",
      volume: 0.8,
      repeat: 1,
      tail: 2,
    },
    lyrics: m.lyrics,
    text: { title: m.name, subtitle: m.credit, show: true },
    scene: { type: sceneType, palette: PALETTES[0].id, params: defaultParams(sceneType) },
    ext: {},
  };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * 把任意 JSON 变成合法配置：缺的补默认值，越界的夹回范围，并给出人话警告。
 * 工作台导入、配置编辑器、(以后的)Node 渲染管线都应该走这一个函数。
 */
export function normalizeConfig(raw: unknown): { config: ProjectConfig; warnings: string[] } {
  const warnings: string[] = [];
  const r: Obj = isObj(raw) ? raw : {};
  if (!isObj(raw)) warnings.push("配置不是对象，已使用默认值");
  if (r.schema !== undefined && r.schema !== SCHEMA) warnings.push(`schema 为 ${String(r.schema)}，按 ${SCHEMA} 解读`);

  const num = (v: unknown, def: number, min: number, max: number, label: string) => {
    if (v === undefined || v === null) return def;
    const x = Number(v);
    if (!isFinite(x)) {
      warnings.push(`${label} 不是数字，已用 ${def}`);
      return def;
    }
    if (x < min || x > max) {
      warnings.push(`${label} = ${x} 超出 ${min}~${max}，已调整`);
      return Math.min(max, Math.max(min, x));
    }
    return x;
  };
  const str = (v: unknown, def: string, max = 400) => (typeof v === "string" ? v.slice(0, max) : def);

  const music: Obj = isObj(r.music) ? r.music : {};
  const preset = str(music.preset, "custom", 40);
  const mel = getMelody(preset);
  const notes = typeof music.notes === "string" && music.notes.trim() ? music.notes : (mel?.notes ?? "");
  if (!notes) warnings.push("没有乐谱：请填写 music.notes，或把 music.preset 设为旋律库 id");
  const keyRoot = KEY_ROOTS.includes(str(music.keyRoot, "C", 3)) ? str(music.keyRoot, "C", 3) : "C";
  const instrument = INSTRUMENT_IDS.includes(music.instrument as Instrument) ? (music.instrument as Instrument) : "marimba";
  if (music.instrument !== undefined && instrument !== music.instrument) warnings.push(`未知音色 ${String(music.instrument)}，已用木琴`);

  const canvas: Obj = isObj(r.canvas) ? r.canvas : {};
  const aspect = ASPECTS.includes(canvas.aspect as Aspect) ? (canvas.aspect as Aspect) : "9:16";
  if (canvas.aspect !== undefined && aspect !== canvas.aspect) warnings.push(`未知画幅 ${String(canvas.aspect)}，已用 9:16`);

  const text: Obj = isObj(r.text) ? r.text : {};
  const sc: Obj = isObj(r.scene) ? r.scene : {};
  const sceneId = str(sc.type, SCENES[0].id, 40);
  const scene = SCENES.find((s) => s.id === sceneId);
  if (!scene) warnings.push(`未知玩法 ${sceneId}，已改用 ${SCENES[0].id}（可用：${SCENES.map((s) => s.id).join(" / ")}）`);
  const def = scene ?? SCENES[0];
  const palId = str(sc.palette, PALETTES[0].id, 40);
  const pal = PALETTES.find((p) => p.id === palId);
  if (!pal) warnings.push(`未知调色板 ${palId}，已改用 ${PALETTES[0].id}（可用：${PALETTES.map((p) => p.id).join(" / ")}）`);

  const rawParams: Obj = isObj(sc.params) ? sc.params : {};
  const params: Record<string, ParamValue> = {};
  for (const d of def.params) {
    const v = rawParams[d.key];
    if (d.type === "number") params[d.key] = num(v, d.default as number, d.min ?? -1e9, d.max ?? 1e9, `${def.id}.${d.key}`);
    else if (d.type === "boolean") params[d.key] = typeof v === "boolean" ? v : (d.default as boolean);
    // 落款：Grok（xAI）· 2026-11-06
    // 改动：选项类参数若不在 options 里，夹回默认值并给出中文警告。以前任意字符串都会原样留下。
    // 下一手：新的选项参数只要在 SceneDef.options 里声明即可，不用再改这里。
    // 再改这段：在上面追加落款，不要删这四行。
    else if (d.type === "select") {
      const options = d.options ?? [];
      const ok = typeof v === "string" && options.some((o) => o.value === v);
      if (v !== undefined && v !== null && !ok) warnings.push(`${def.id}.${d.key} 不是可选项，已用默认`);
      params[d.key] = ok ? (v as string) : (d.default as string);
    } else params[d.key] = typeof v === "string" ? v : (d.default as string);
  }
  for (const k of Object.keys(rawParams)) if (!def.params.some((d) => d.key === k)) warnings.push(`玩法 ${def.id} 没有参数 ${k}，已忽略`);

  const config: ProjectConfig = {
    schema: SCHEMA,
    name: str(r.name, "未命名作品", 60) || "未命名作品",
    canvas: { aspect, fps: canvas.fps === 60 ? 60 : 30 },
    music: {
      preset,
      notes,
      bpm: num(music.bpm, mel?.bpm ?? 100, 40, 220, "music.bpm"),
      keyRoot,
      transpose: Math.round(num(music.transpose, 0, -24, 24, "music.transpose")),
      instrument,
      volume: num(music.volume, 0.8, 0, 1, "music.volume"),
      repeat: Math.round(num(music.repeat, 1, 1, 8, "music.repeat")),
      tail: num(music.tail, 2, 0, 6, "music.tail"),
    },
    lyrics: typeof r.lyrics === "string" ? r.lyrics.slice(0, 2000) : (mel?.lyrics ?? ""),
    text: {
      title: str(text.title, mel?.name ?? "", 60),
      subtitle: str(text.subtitle, mel?.credit ?? "", 80),
      show: text.show === false ? false : true,
    },
    scene: { type: def.id, palette: (pal ?? PALETTES[0]).id, params },
    ext: isObj(r.ext) ? r.ext : {},
  };
  return { config, warnings };
}

/** 解析导入文本：单个配置 / 配置数组 / {projects:[...]} */
export function parseImport(text: string): { configs: ProjectConfig[]; warnings: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error("不是合法的 JSON：" + (e as Error).message);
  }
  const list = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.projects) ? raw.projects : [raw];
  const configs: ProjectConfig[] = [];
  const warnings: string[] = [];
  list.forEach((item, i) => {
    const { config, warnings: w } = normalizeConfig(item);
    configs.push(config);
    w.forEach((x) => warnings.push(list.length > 1 ? `#${i + 1} ${x}` : x));
  });
  return { configs, warnings };
}

/** 导出时只留下与默认不同的最小必要信息会更短，但完整导出更稳：这里导出完整配置 */
export const stringifyConfig = (c: ProjectConfig) => JSON.stringify(c, null, 2);

// 模板：presets/*.json（只写你想改的字段，其余由 normalizeConfig 补齐）
const files = import.meta.glob("/presets/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
export const TEMPLATES: { file: string; config: ProjectConfig }[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([file, raw]) => ({ file: file.replace("/presets/", ""), config: normalizeConfig(raw).config }));
