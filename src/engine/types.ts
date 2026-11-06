// ============================================================
// video-kit 工作台 · 核心类型
// 配置文件(JSON) = ProjectConfig。工作台只是这份 JSON 的可视化编辑器。
// ============================================================

export type Instrument = "marimba" | "bell" | "pluck" | "piano";
export type Aspect = "9:16" | "16:9" | "1:1";
export type ParamValue = number | boolean | string;

export interface ProjectConfig {
  schema: "video-kit.project/1";
  name: string;
  canvas: { aspect: Aspect; fps: 30 | 60 };
  music: {
    /** 旋律库 id，仅作来源标记；真正演奏的是 notes */
    preset: string;
    /** 乐谱文本：音名 "C4:1 D#4:0.5 R:1" 或 简谱 "1 2 3' 0 -" */
    notes: string;
    bpm: number;
    /** 简谱的 1 = 哪个音（C~B） */
    keyRoot: string;
    /** 整体移调（半音） */
    transpose: number;
    instrument: Instrument;
    volume: number;
    repeat: number;
    /** 尾音秒数 */
    tail: number;
  };
  /** 歌词/文字，按音符顺序一音一字(中文)或一音一词(含空格的英文) */
  lyrics: string;
  text: { title: string; subtitle: string; show: boolean };
  scene: {
    type: string;
    palette: string;
    params: Record<string, ParamValue>;
  };
  /** 预留：以后的新能力(多声部/背景图/字幕样式等)先放这里，不破坏旧配置 */
  ext: Record<string, unknown>;
}

export interface NoteEvent {
  i: number;
  /** 命中时刻(秒，含片头) */
  t: number;
  dur: number;
  midi: number;
  lyric: string;
}

export interface Timeline {
  events: NoteEvent[];
  lead: number;
  duration: number;
  minMidi: number;
  maxMidi: number;
}

export interface Palette {
  id: string;
  name: string;
  bg: [string, string];
  accent: string;
  accent2: string;
  ink: string;
  soft: string;
  line: string;
  hue0: number;
  span: number;
  sat: number;
  light: number;
}

export interface ParamDef {
  key: string;
  label: string;
  type: "number" | "boolean" | "select";
  default: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  hint?: string;
}

export interface SceneInput {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** 单位长度：短边/540 */
  u: number;
  t: number;
  tl: Timeline;
  cfg: ProjectConfig;
  pal: Palette;
  p: Record<string, ParamValue>;
}

export interface SceneDef {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  params: ParamDef[];
  /** 必须是 t 的纯函数：不可累积状态、不可使用 Math.random / Date.now */
  draw: (a: SceneInput) => void;
}
