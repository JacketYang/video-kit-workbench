import type { NoteEvent, Palette, ProjectConfig, Timeline } from "./types";

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

/** 确定性随机：同一个 seed 永远得到同一串数 */
export function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash01 = (n: number) => rng(Math.floor(n) * 7919 + 13)();

/** 最后一个 ev.t <= t 的下标，没有则 -1 */
export function idxAt(events: NoteEvent[], t: number) {
  let lo = 0,
    hi = events.length - 1,
    r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (events[m].t <= t) {
      r = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return r;
}

export function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}

export function noteHsl(pal: Palette, midi: number): [number, number, number] {
  const pc = ((midi % 12) + 12) % 12;
  return [(pal.hue0 + (pc / 12) * pal.span) % 360, pal.sat, pal.light];
}
export const hsl = (c: [number, number, number], dl = 0, a = 1) =>
  `hsla(${c[0].toFixed(0)},${c[1]}%,${clamp(c[2] + dl, 0, 100)}%,${clamp(a, 0, 1)})`;

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const FONT = `"Noto Sans SC","PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif`;

export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, pal.bg[0]);
  g.addColorStop(1, pal.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.5) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** 所有场景共用：标题、副标题、进度线 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  u: number,
  t: number,
  tl: Timeline,
  cfg: ProjectConfig,
  pal: Palette,
) {
  if (cfg.text.show && (cfg.text.title || cfg.text.subtitle)) {
    const fade = smooth(t / 0.8);
    ctx.save();
    ctx.globalAlpha = 0.92 * fade;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const maxW = w - 56 * u;
    let size = 38 * u;
    ctx.font = `700 ${size}px ${FONT}`;
    while (ctx.measureText(cfg.text.title).width > maxW && size > 14 * u) {
      size -= 2 * u;
      ctx.font = `700 ${size}px ${FONT}`;
    }
    ctx.fillStyle = pal.ink;
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 8 * u;
    ctx.fillText(cfg.text.title, 28 * u, 28 * u + size);
    if (cfg.text.subtitle) {
      ctx.font = `400 ${17 * u}px ${FONT}`;
      ctx.globalAlpha = 0.65 * fade;
      ctx.fillText(cfg.text.subtitle, 29 * u, 28 * u + size + 26 * u);
    }
    ctx.restore();
  }
  const p = clamp(t / tl.duration, 0, 1);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(0, h - 5 * u, w, 5 * u);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(0, h - 5 * u, w * p, 5 * u);
}
