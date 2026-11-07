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
 *
 * 落款：Grok（xAI）· 2026-11-07
 * 改动：下落和节奏对不齐。原因是每颗球固定飞 0.5～1.2 秒，还在钉子上一步一顿，顿的时间不是音符。
 *       改成：上一颗落地的瞬间，下一颗才出发；这一段空隙就是它的全部下落，落到盒子的那一帧才响。
 *       同一时间只掉一颗。钉子不再挡路，避免多出一拍看不见的碰撞。
 * 下一手：如果还是觉得慢半拍，先看是不是落点（响）而不是起飞（不响）。不要把飞行时间再写成固定秒数。
 * 再改：往下追加，不要删上面三条。
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
  home: { x: number; y: number };
  at: { x: number; y: number };
  side: number;
}

interface Layout {
  margin: number;
  innerW: number;
  bins: number;
  binW: number;
  ballR: number;
  hopper: { x: number; y: number; w: number; h: number };
  trackTop: number;
  binTop: number;
  binH: number;
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
  return { margin, innerW, bins, binW, ballR, hopper, trackTop, binTop, binH };
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

function buildBalls(events: NoteEvent[], bins: number, L: Layout): Ball[] {
  const counts = new Array<number>(bins).fill(0);
  const draft = events.map((e, i) => {
    const color = colorOf(e.midi, events, bins);
    const slot = counts[color];
    counts[color] += 1;
    const prev = i === 0 ? 0 : events[i - 1].t;
    return { i: e.i, midi: e.midi, color, slot, release: prev, arrive: e.t };
  });
  return draft.map((b) => {
    const home = hopperXY(b.i, draft.length, L);
    const at = slotXY(b.slot, counts[b.color], b.color, L);
    const side = (b.color % 2 === 0 ? 1 : -1) * L.ballR * 0.85;
    return { ...b, binCount: counts[b.color], home, at, side };
  });
}

/** 上一颗落地 = 这一颗出发；这一颗落地 = 这个音。中间不停顿。 */
function place(b: Ball, t: number): { x: number; y: number; flying: boolean } {
  if (t <= b.release) return { ...b.home, flying: false };
  if (t >= b.arrive) {
    const age = t - b.arrive;
    const amp = Math.abs(b.at.y - b.home.y) * 0.045;
    const bounce = age < 0.12 ? Math.sin((age / 0.12) * Math.PI) * amp * (1 - age / 0.12) : 0;
    return { x: b.at.x, y: b.at.y - bounce, flying: false };
  }
  const u = (t - b.release) / Math.max(0.001, b.arrive - b.release);
  const g = Math.pow(u, 1.15);
  return {
    x: lerp(b.home.x, b.at.x, g) + Math.sin(Math.PI * u) * b.side,
    y: lerp(b.home.y, b.at.y, g),
    flying: true,
  };
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
  tagline: "落到盒子的那一下才响",
  desc: "每个音符是一颗球，而且同一时间只掉一颗。上一颗落地响起的瞬间，下一颗才出发；两下之间的空隙就是这一颗的全部下落。落到盒子的那一帧才是这个音。同一个音进同一个盒子。不要再给下落单独设一个秒数。",
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
      const r = pt.flying ? L.ballR * 1.08 : L.ballR;
      if (pt.flying) {
        const back = place(b, t - (b.arrive - b.release) * 0.08);
        drawBall(ctx, back.x, back.y, r * 0.92, hue, 0.18);
      }
      drawBall(ctx, pt.x, pt.y, r, hue, pt.flying || t >= b.arrive ? 1 : 0.85);
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
