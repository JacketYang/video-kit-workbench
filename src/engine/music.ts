import type { NoteEvent, ProjectConfig, Timeline } from "./types";

// ------------------------------------------------------------
// 旋律库：全部为公版旋律或本项目原创。不要放现代流行歌曲旋律。
// ------------------------------------------------------------
export interface Melody {
  id: string;
  name: string;
  bpm: number;
  notes: string;
  lyrics: string;
  credit: string;
}

export const MELODIES: Melody[] = [
  {
    id: "twinkle",
    name: "小星星",
    bpm: 112,
    notes:
      "C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2",
    lyrics: "一 闪 一 闪 亮 晶 晶 满 天 都 是 小 星 星 挂 在 天 空 放 光 明 好 像 许 多 小 眼 睛 一 闪 一 闪 亮 晶 晶 满 天 都 是 小 星 星",
    credit: "传统旋律 · 公版",
  },
  {
    id: "ode",
    name: "欢乐颂",
    bpm: 108,
    notes:
      "E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:0.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2 | D4 D4 E4 C4 | D4 E4:0.5 F4:0.5 E4 C4 | D4 E4:0.5 F4:0.5 E4 D4 | C4 D4 G3:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2",
    lyrics: "",
    credit: "贝多芬 · 公版",
  },
  {
    id: "elise",
    name: "献给爱丽丝（开头）",
    bpm: 128,
    notes:
      "E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1.5 C4:0.5 E4:0.5 A4:0.5 B4:1.5 E4:0.5 G#4:0.5 B4:0.5 C5:1.5 E4:0.5 E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1.5 C4:0.5 E4:0.5 A4:0.5 B4:1.5 E4:0.5 C5:0.5 B4:0.5 A4:2",
    lyrics: "",
    credit: "贝多芬 · 公版",
  },
  {
    id: "jingle",
    name: "铃儿响叮当（副歌）",
    bpm: 132,
    notes:
      "E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4 F4 F4 F4:1.5 F4:0.5 F4 E4 E4 E4:0.5 E4:0.5 E4 D4 D4 E4 D4:2 G4:2 E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4",
    lyrics: "",
    credit: "Pierpont 1857 · 公版",
  },
  {
    id: "forest",
    name: "林间脚步（原创）",
    bpm: 100,
    notes:
      "C4 E4 G4 A4 G4 E4 D4:2 | E4 G4 A4 C5 A4 G4 E4:2 | D4 E4 G4 E4 D4 C4 A3:2 | C4 D4 E4 G4 A4:1.5 G4:0.5 E4 C4:2",
    lyrics: "清晨薄雾轻轻落 林间脚步慢慢走 风吹叶子一起唱 一步一声回响满山",
    credit: "本项目原创 · 可自由使用",
  },
  {
    id: "scale",
    name: "C 大调音阶（测试）",
    bpm: 120,
    notes: "1 2 3 4 5 6 7 1' 1' 7 6 5 4 3 2 1:2",
    lyrics: "",
    credit: "测试用",
  },
];
export const getMelody = (id: string) => MELODIES.find((m) => m.id === id);

// ------------------------------------------------------------
// 乐谱解析
// ------------------------------------------------------------
export interface ParsedItem {
  midi: number | null; // null = 休止
  beats: number;
}

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const KEY_ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export function rootPc(root: string) {
  const l = LETTER[root[0]?.toUpperCase() ?? "C"] ?? 0;
  const acc = root[1] === "#" ? 1 : root[1] === "b" ? -1 : 0;
  return (l + acc + 12) % 12;
}

export function parseNotes(text: string, keyRoot = "C"): { items: ParsedItem[]; errors: string[] } {
  const items: ParsedItem[] = [];
  const errors: string[] = [];
  const root = rootPc(keyRoot);
  const tokens = text
    .replace(/[|｜]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (const tok of tokens) {
    const [body, durS] = tok.split(":");
    const dur = durS === undefined ? 1 : Number(durS);
    if (!isFinite(dur) || dur <= 0 || dur > 16) {
      errors.push(`时值无效：${tok}`);
      continue;
    }
    let m: RegExpMatchArray | null;
    if (body === "-") {
      // 简谱延音线：给上一个音加时值
      const last = items[items.length - 1];
      if (last) last.beats += dur;
      else errors.push("开头不能用 -");
    } else if (/^[Rr]$/.test(body) || body === "0") {
      items.push({ midi: null, beats: dur });
    } else if ((m = body.match(/^([A-Ga-g])([#b]?)(-?\d)$/))) {
      const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
      items.push({ midi: (Number(m[3]) + 1) * 12 + LETTER[m[1].toUpperCase()] + acc, beats: dur });
    } else if ((m = body.match(/^([#b]?)([1-7])([',]*)$/))) {
      const acc = m[1] === "#" ? 1 : m[1] === "b" ? -1 : 0;
      const up = (m[3].match(/'/g) ?? []).length;
      const down = (m[3].match(/,/g) ?? []).length;
      items.push({ midi: 60 + root + MAJOR[Number(m[2]) - 1] + acc + 12 * (up - down), beats: dur });
    } else errors.push(`无法识别：${tok}`);
  }
  return { items, errors };
}

export function parseLyrics(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const clean = (s: string) => s.replace(/[，。！？、；：“”‘’,.!?;:"'()（）…—]/g, "");
  if (/[A-Za-z]/.test(t)) return t.split(/\s+/).map(clean).filter(Boolean);
  return Array.from(clean(t).replace(/\s+/g, ""));
}

export const LEAD = 0.9;
export const MAX_EVENTS = 600;
export const MAX_DURATION = 300;

export function compileTimeline(cfg: ProjectConfig): { tl: Timeline; warnings: string[] } {
  const m = cfg.music;
  const { items, errors } = parseNotes(m.notes, m.keyRoot);
  const warnings = errors.slice(0, 5);
  const spb = 60 / m.bpm;
  const lyr = parseLyrics(cfg.lyrics);
  const events: NoteEvent[] = [];
  let beat = 0;
  outer: for (let r = 0; r < m.repeat; r++) {
    let li = 0;
    for (const it of items) {
      if (it.midi !== null) {
        if (events.length >= MAX_EVENTS || LEAD + beat * spb > MAX_DURATION) {
          warnings.push(`音符过多或超过 ${MAX_DURATION}s，已截断`);
          break outer;
        }
        events.push({
          i: events.length,
          t: LEAD + beat * spb,
          dur: Math.min(it.beats * spb, 2.4),
          midi: Math.round(it.midi + m.transpose),
          lyric: lyr[li] ?? "",
        });
        li++;
      }
      beat += it.beats;
    }
  }
  if (events.length === 0) warnings.push("没有可演奏的音符，请检查乐谱");
  const last = events[events.length - 1];
  const end = last ? last.t + last.dur : LEAD;
  const midis = events.map((e) => e.midi);
  return {
    tl: {
      events,
      lead: LEAD,
      duration: Math.max(2, end + m.tail),
      minMidi: midis.length ? Math.min(...midis) : 60,
      maxMidi: midis.length ? Math.max(...midis) : 72,
    },
    warnings,
  };
}

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const midiName = (m: number) => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
