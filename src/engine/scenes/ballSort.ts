/**
 * 落款：Grok（xAI）· 2026-11-06
 * 改动：新增玩法 ball-sort（分球机）。默认 16 球、4 盒、直道、无门，分完停约 1 秒。
 *       这是编排出来的分拣，不是真实碰撞：同一个参数，球永远进同一只盒子。
 * 下一手：螺旋 / 固定门 / 移动门已经是参数，不要为此再开文件。
 *       不要删 bubble-keys、glow-staff、falling-bars。
 *       成片时长仍由乐谱决定（模板 presets/06-ball-sort.json 用静音乐谱定在约 14 秒），不要在这里另写时钟。
 * 再改本文件：在本注释下面追加「落款 / 改动 / 下一手」，不要删上面这段。
 *
 * 落款：Grok（xAI）· 2026-11-07
 * 改动：11-06 那版是静音假乐谱加热色滑道，音画各玩各的，没有看点。整段重写。
 *       现在一音一球：球落到盒子的瞬间 = 你听到的那个音；同一个音永远进同一个盒子。
 *       钉子板只负责让下落好看，落点时间锁死在音符上。拿掉球数 / 螺旋 / 门，那些和声音对不上。
 * 下一手：嫌节奏或钉子，只改本文件的路线和 presets/06-ball-sort.json 的乐谱。不要再把音量调成 0，不要加回和音符无关的球数。
 *       不要删泡泡琴键、五线谱流光、下落音条。
 * 再改：往下追加，不要删上面两条。
 */
import type { NoteEvent, SceneDef } from "../types";
import { FONT, clamp, drawBackground, drawOverlay, drawVignette, hexA, hsl, lerp, roundRect } from "../util";

const BIN_HUES: [number, number, number][] = [
  [8, 88, 62],
  [210, 84, 62],
  [48, 92, 58],
  [138, 74, 50],
  [275, 72, 66],
  [168, 72, 50],
];

interface Ball {
  i: number;
  midi: number;
  color: number;
  slot: number;
  binCount: number;
  release: number;
  arrive: number;
  pts: { x: number; y: number }[];
}

interface Layout {
  margin: number;
  innerW: number;
  bins: number;
  binW: number;
  ballR: number;
  pegR: number;
  hopper: { x: number; y: number; w: number; h: number };
  trackTop: number;
  trackBot: number;
  binTop: number;
  binH: number;
  rows: { x: number; y: number }[][];
}

const hueOf = (i: number) => BIN_HUES[i % BIN_HUES.length];

function shownBins(events: NoteEvent[], bins: number) {
  const n = new Set(events.map((e) => e.midi)).size;
  return clamp(Math.min(Math.round(bins) || 4, Math.max(1, n)), 1, 6);
}

function colorOf(midi: number, events: NoteEvent[], bins: number) {
  const midis = [...new Set(events.map((e) => e.midi))].sort((a, b) => a - b);
  const idx = Math.max(0, midis.indexOf(midi));
  if (midis.length <= 1) return 0;
  return clamp(Math.round((idx / (midis.length - 1)) * (bins - 1)), 0, bins - 1);
}

function layoutOf(w: number, h: number, u: number, bins: number, perBin: number): Layout {
  const margin = Math.max(16 * u, w * 0.08);
  const innerW = w - margin * 2;
  const binW = innerW / bins;
  const binH = Math.min(h * 0.16, 150 * u);
  const binTop = h * 0.78;
  const cols = perBin > 8 ? 3 : 2;
  let ballR = Math.min(binW * 0.22, 14.5 * u);
  while (Math.ceil(perBin / cols) * ballR * 2.12 > binH * 0.72 && ballR > 4.5 * u) ballR *= 0.9;
  const hopperH = Math.max(ballR * 4.8, h * 0.11);
  const hopper = { x: margin, y: h * 0.145, w: innerW, h: hopperH };
  const trackTop = hopper.y + hopper.h + 18 * u;
  const trackBot = binTop - Math.max(28 * u, ballR * 1.6);
  const pegRows = 6;
  const rows: { x: number; y: number }[][] = [];
  for (let r = 0; r < pegRows; r++) {
    const count = bins + 1 + (r % 2 === 0 ? 1 : 0);
    const y = lerp(trackTop, trackBot, (r + 0.5) / pegRows);
    const row: { x: number; y: number }[] = [];
    for (let c = 0; c < count; c++) row.push({ x: margin + ((c + 0.5) * innerW) / count, y });
    rows.push(row);
  }
  return {
    margin,
    innerW,
    bins,
    binW,
    ballR,
    pegR: Math.max(3.2 * u, ballR * 0.28),
    hopper,
    trackTop,
    trackBot,
    binTop,
    binH,
    rows,
  };
}

function hopperXY(i: number, n: number, L: Layout) {
  const gap = L.ballR * 2.15;
  const cols = Math.max(1, Math.min(8, Math.floor((L.hopper.w - L.ballR * 2) / gap)));
  const col = i % cols;
  const row = Math.floor(i / cols);
  const gridW = (Math.min(cols, n) - 1) * gap;
  const x = L.hopper.x + L.hopper.w / 2 - gridW / 2 + col * gap;
  const y = L.hopper.y + L.hopper.h - L.ballR * 1.35 - row * gap;
  return {
    x: clamp(x, L.hopper.x + L.ballR, L.hopper.x + L.hopper.w - L.ballR),
    y: clamp(y, L.hopper.y + L.ballR, L.hopper.y + L.hopper.h - L.ballR),
  };
}

function slotXY(slot: number, count: number, color: number, L: Layout) {
  const cols = count > 8 ? 3 : 2;
  const col = slot % cols;
  const row = Math.floor(slot / cols);
  const gap = L.ballR * 2.08;
  const used = Math.min(cols, count);
  const cx = L.margin + (color + 0.5) * L.binW;
  return {
    x: cx - ((used - 1) * gap) / 2 + col * gap,
    y: L.binTop + L.binH - L.ballR * 1.45 - row * gap,
  };
}

function nearestPeg(row: { x: number; y: number }[], x: number) {
  let best = row[0];
  let d = Infinity;
  for (const p of row) {
    const dd = Math.abs(p.x - x);
    if (dd < d) {
      d = dd;
      best = p;
    }
  }
  return best;
}

function buildBalls(events: NoteEvent[], bins: number, L: Layout): Ball[] {
  const counts = new Array<number>(bins).fill(0);
  const draft = events.map((e) => {
    const color = colorOf(e.midi, events, bins);
    const slot = counts[color];
    counts[color] += 1;
    const flight = Math.min(1.15, Math.max(0.48, e.t - 0.08));
    return { i: e.i, midi: e.midi, color, slot, release: e.t - flight, arrive: e.t };
  });
  return draft.map((b) => {
    const home = hopperXY(b.i, draft.length, L);
    const slot = slotXY(b.slot, counts[b.color], b.color, L);
    const nudge = (b.slot - (counts[b.color] - 1) / 2) * L.ballR * 0.22;
    const pts = [home];
    L.rows.forEach((row, ri) => {
      const goal = lerp(home.x, slot.x, (ri + 1) / (L.rows.length + 1));
      const peg = nearestPeg(row, goal);
      pts.push({ x: clamp(peg.x + nudge, L.margin + L.ballR, L.margin + L.innerW - L.ballR), y: peg.y });
    });
    pts.push(slot);
    return { ...b, binCount: counts[b.color], pts };
  });
}

function place(b: Ball, t: number): { x: number; y: number; hit: boolean } {
  const home = b.pts[0];
  const slot = b.pts[b.pts.length - 1];
  if (t <= b.release) return { ...home, hit: false };
  if (t >= b.arrive) {
    const age = t - b.arrive;
    const amp = Math.abs(slot.y - b.pts[b.pts.length - 2].y) * 0.18;
    const bounce = Math.abs(Math.sin(Math.min(age, 0.32) * 18)) * Math.exp(-age * 8) * amp;
    return { x: slot.x, y: slot.y - bounce, hit: age < 0.12 };
  }
  const u = clamp((t - b.release) / Math.max(0.05, b.arrive - b.release), 0, 0.9999);
  const seg = u * (b.pts.length - 1);
  const i = Math.floor(seg);
  const f = seg - i;
  const g = f * f;
  const a = b.pts[i];
  const c = b.pts[i + 1];
  return { x: lerp(a.x, c.x, g), y: lerp(a.y, c.y, g), hit: f < 0.08 };
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hue: [number, number, number], alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.92, r * 0.68, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.34, y - r * 0.38, r * 0.08, x, y, r);
  g.addColorStop(0, hsl(hue, 18, 1));
  g.addColorStop(0.55, hsl(hue, 0, 1));
  g.addColorStop(1, hsl(hue, -18, 1));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.34, r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.fill();
  ctx.restore();
}

export const ballSort: SceneDef = {
  id: "ball-sort",
  name: "分球机",
  tagline: "一音一球，落下的时候才响",
  desc: "每个音符是一颗球。球落到盒子的那一下，就是你听到的音；同一个音永远进同一个盒子。前面几下落进不同的盒子，最后几下把每个盒子填满。球数不要另设，改乐谱就等于改球。钉子只让下落弯一下，落点时间锁在音符上，不是静音配图。",
  params: [
    {
      key: "bins",
      label: "盒子数",
      type: "number",
      min: 2,
      max: 6,
      step: 1,
      default: 4,
      hint: "不会超过这段乐谱里不同音高的数量",
    },
  ],
  draw({ ctx, w, h, u, t, tl, cfg, pal, p }) {
    const events = tl.events;
    const bins = shownBins(events, Number(p.bins) || 4);
    const per = Math.max(1, Math.ceil(events.length / bins));
    const L = layoutOf(w, h, u, bins, per);
    const balls = buildBalls(events, bins, L);

    drawBackground(ctx, w, h, pal);

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.04)";
    roundRect(ctx, L.margin - 10 * u, L.hopper.y - 12 * u, L.innerW + 20 * u, L.binTop + L.binH - L.hopper.y + 22 * u, 20 * u);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,.35)";
    roundRect(ctx, L.hopper.x, L.hopper.y, L.hopper.w, L.hopper.h, 16 * u);
    ctx.fill();
    ctx.strokeStyle = hexA(pal.line, 0.8);
    ctx.lineWidth = 2 * u;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(L.hopper.x + L.hopper.w * 0.28, L.hopper.y + L.hopper.h);
    ctx.lineTo(L.margin + L.innerW * 0.5, L.trackTop + 8 * u);
    ctx.lineTo(L.hopper.x + L.hopper.w * 0.72, L.hopper.y + L.hopper.h);
    ctx.strokeStyle = hexA(pal.line, 0.45);
    ctx.stroke();

    for (const row of L.rows) {
      for (const peg of row) {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, L.pegR, 0, Math.PI * 2);
        ctx.fillStyle = hexA(pal.ink, 0.88);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(peg.x - L.pegR * 0.3, peg.y - L.pegR * 0.3, L.pegR * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,.55)";
        ctx.fill();
      }
    }

    for (let c = 0; c < bins; c++) {
      const x = L.margin + c * L.binW;
      const hue = hueOf(c);
      const mine = balls.filter((b) => b.color === c);
      const arrived = mine.filter((b) => t >= b.arrive - 0.02).length;
      let glow = 0;
      for (const b of mine) {
        const age = t - b.arrive;
        if (age >= 0 && age < 0.4) glow = Math.max(glow, 1 - age / 0.4);
      }
      const full = mine.length > 0 && arrived >= mine.length;
      ctx.fillStyle = hsl(hue, -8, 0.16 + glow * 0.28);
      roundRect(ctx, x + 4 * u, L.binTop, L.binW - 8 * u, L.binH, 14 * u);
      ctx.fill();
      ctx.lineWidth = (full ? 3.5 : 2) * u;
      ctx.strokeStyle = hsl(hue, 8, full || glow > 0.2 ? 0.95 : 0.45);
      ctx.stroke();
      ctx.font = `700 ${Math.max(12, 15 * u)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = hexA(pal.ink, 0.92);
      ctx.fillText(`${arrived}/${mine.length || 0}`, x + L.binW / 2, L.binTop - Math.max(14 * u, L.ballR));
    }
    ctx.restore();

    const drawn = balls
      .map((b) => ({ b, pt: place(b, t) }))
      .sort((a, c) => a.pt.y - c.pt.y);
    for (const { b, pt } of drawn) {
      const hue = hueOf(b.color);
      if (t > b.release && t < b.arrive) {
        for (let k = 2; k >= 1; k--) {
          const g = place(b, t - k * 0.045);
          drawBall(ctx, g.x, g.y, L.ballR * (1 - k * 0.08), hue, 0.12);
        }
      }
      drawBall(ctx, pt.x, pt.y, L.ballR, hue, 1);
      const age = t - b.arrive;
      if (age >= 0 && age < 0.26) {
        ctx.strokeStyle = hsl(hue, 10, 0.7 * (1 - age / 0.26));
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, L.ballR * (1.1 + age * 6), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawVignette(ctx, w, h, 0.36);
    drawOverlay(ctx, w, h, u, t, tl, cfg, pal);
  },
};
