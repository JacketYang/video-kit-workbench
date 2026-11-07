/**
 * 落款：Grok（xAI）· 2026-11-06
 * 改动：新增玩法 ball-sort（分球机）。默认 16 球、4 盒、直道、无门，分完停约 1 秒。
 *       这是编排出来的分拣，不是真实碰撞：同一个参数，球永远进同一只盒子。
 * 下一手：螺旋 / 固定门 / 移动门已经是参数，不要为此再开文件。
 *       不要删 bubble-keys、glow-staff、falling-bars。
 *       成片时长仍由乐谱决定（模板 presets/06-ball-sort.json 用静音乐谱定在约 14 秒），不要在这里另写时钟。
 * 再改本文件：在本注释下面追加「落款 / 改动 / 下一手」，不要删上面这段。
 */
import type { ParamValue, SceneDef } from "../types";
import { FONT, clamp, drawBackground, drawOverlay, drawVignette, hexA, hsl, lerp, rng, roundRect, smooth } from "../util";

const BIN_HUES: [number, number, number][] = [
  [8, 86, 62],
  [210, 82, 62],
  [48, 90, 60],
  [138, 72, 52],
  [275, 70, 66],
  [168, 70, 52],
];

type Gate = "none" | "fixed" | "moving";
type PathKind = "straight" | "spiral";

interface Layout {
  margin: number;
  innerW: number;
  bins: number;
  binW: number;
  ballR: number;
  hopper: { x: number; y: number; w: number; h: number };
  trackTop: number;
  trackBot: number;
  gateY: number;
  binTop: number;
  binH: number;
  cx: number;
  cy: number;
}

interface Ball {
  i: number;
  n: number;
  color: number;
  slot: number;
  binCount: number;
  release: number;
  toGate: number;
  wait: number;
  arrive: number;
}

interface Pt {
  x: number;
  y: number;
  moving: boolean;
}

const binHue = (i: number) => BIN_HUES[i % BIN_HUES.length];
const easeIn = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x;
};

function layoutOf(w: number, h: number, u: number, bins: number, perBin: number): Layout {
  const margin = Math.max(14 * u, w * 0.07);
  const innerW = w - margin * 2;
  const binW = innerW / bins;
  const binH = Math.min(h * 0.155, 148 * u);
  const binTop = h * 0.785;
  const cols = perBin > 8 ? 3 : 2;
  let ballR = Math.min(binW * 0.24, 15.5 * u);
  while (Math.ceil(perBin / cols) * ballR * 2.15 > binH * 0.76 && ballR > 4.5 * u) ballR *= 0.9;
  const hopperH = Math.max(ballR * 4.6, h * 0.105);
  const hopper = { x: margin, y: h * 0.145, w: innerW, h: hopperH };
  const trackTop = hopper.y + hopper.h + 16 * u;
  const trackBot = binTop - Math.max(26 * u, ballR * 1.8);
  return {
    margin,
    innerW,
    bins,
    binW,
    ballR,
    hopper,
    trackTop,
    trackBot,
    gateY: trackTop + (trackBot - trackTop) * 0.48,
    binTop,
    binH,
    cx: w / 2,
    cy: (trackTop + trackBot) / 2,
  };
}

function gateCenterX(t: number, L: Layout) {
  const left = L.margin + L.ballR;
  const right = L.margin + L.innerW - L.ballR;
  const period = 1.35;
  const ph = (((t % period) + period) % period) / period;
  const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
  return left + (right - left) * tri;
}

function gateAligned(t: number, laneX: number, L: Layout) {
  return Math.abs(gateCenterX(t, L) - laneX) <= Math.max(L.binW * 0.42, L.ballR * 2.2);
}

function laneX(color: number, L: Layout) {
  return L.margin + (color + 0.5) * L.binW;
}

function hopperXY(i: number, n: number, L: Layout) {
  const gap = L.ballR * 2.12;
  const maxCols = Math.max(1, Math.floor((L.hopper.w - L.ballR * 2) / gap));
  const cols = Math.min(maxCols, n);
  const col = i % cols;
  const row = Math.floor(i / cols);
  const rows = Math.ceil(n / cols);
  const gridW = (cols - 1) * gap;
  const gridH = (rows - 1) * gap;
  const x = L.hopper.x + L.hopper.w / 2 - gridW / 2 + col * gap;
  const y = L.hopper.y + L.hopper.h / 2 - gridH / 2 + row * gap;
  return {
    x: clamp(x, L.hopper.x + L.ballR * 1.05, L.hopper.x + L.hopper.w - L.ballR * 1.05),
    y: clamp(y, L.hopper.y + L.ballR * 1.05, L.hopper.y + L.hopper.h - L.ballR * 1.05),
  };
}

function slotXY(slot: number, count: number, color: number, L: Layout) {
  const cols = count > 8 ? 3 : 2;
  const col = slot % cols;
  const row = Math.floor(slot / cols);
  const gap = L.ballR * 2.08;
  const used = Math.min(cols, count);
  const cx = laneX(color, L);
  return {
    x: cx - ((used - 1) * gap) / 2 + col * gap,
    y: L.binTop + L.binH - L.ballR * 1.35 - row * gap,
  };
}

function planBalls(n: number, bins: number, path: PathKind, gate: Gate, seed: number, t0: number, t1: number, L: Layout): Ball[] {
  const colors: number[] = [];
  for (let i = 0; i < n; i++) colors.push(i % bins);
  const rand = rng(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = colors[i];
    colors[i] = colors[j];
    colors[j] = tmp;
  }
  const counts = new Array<number>(bins).fill(0);
  const base = colors.map((color, i) => {
    const slot = counts[color];
    counts[color] += 1;
    return { i, color, slot };
  });
  const span = Math.max(0.8, t1 - t0);
  const fit = (compress: number): Ball[] => {
    const toGate = Math.max(0.26, span * 0.22 * compress);
    const toBin = Math.max(0.32, span * 0.3 * compress);
    const releaseSpan = Math.max(0.35, (span - toGate - toBin) * compress);
    return base.map((b) => {
      const release = t0 + (n === 1 ? releaseSpan * 0.15 : (b.i / (n - 1)) * releaseSpan);
      const reach = release + (path === "spiral" ? (toGate + toBin) * 0.45 : toGate);
      let wait = 0;
      if (gate === "fixed") wait = 0.16 + (b.color % 2) * 0.05;
      if (gate === "moving") {
        const lane = laneX(b.color, L);
        wait = 0.5;
        for (let dt = 0; dt <= 1.5; dt += 0.02) {
          if (gateAligned(reach + dt, lane, L)) {
            wait = dt;
            break;
          }
        }
      }
      const arrive = release + toGate + wait + toBin;
      return { ...b, n, binCount: counts[b.color], release, toGate, wait, arrive };
    });
  };
  const lastOf = (xs: Ball[]) => xs.reduce((m, b) => Math.max(m, b.arrive), 0);
  let best = fit(1);
  if (lastOf(best) > t1) {
    let lo = 0.25;
    let hi = 1;
    best = fit(lo);
    for (let k = 0; k < 8; k++) {
      const mid = (lo + hi) / 2;
      const trial = fit(mid);
      if (lastOf(trial) > t1) hi = mid;
      else {
        lo = mid;
        best = trial;
      }
    }
    if (lastOf(best) > t1) best = fit(0.25);
  }
  return best;
}

function spiralPoint(s: number, color: number, L: Layout) {
  const rail = railPoint(Math.min(s, 0.82) / 0.82, L);
  const along = laneX(color, L);
  const peel = smooth(clamp((s - 0.78) / 0.22, 0, 1));
  return {
    x: lerp(rail.x, along, peel),
    y: lerp(rail.y, L.trackBot, peel),
  };
}

function railPoint(s: number, L: Layout) {
  const maxR = Math.min(L.innerW * 0.4, (L.trackBot - L.trackTop) * 0.42);
  const ang = -Math.PI / 2 + s * Math.PI * 2 * 1.25;
  const rad = lerp(maxR, L.ballR * 2.1, s);
  return { x: L.cx + Math.cos(ang) * rad, y: L.cy + Math.sin(ang) * rad * 0.88 };
}

function place(b: Ball, t: number, L: Layout, path: PathKind): Pt {
  const home = hopperXY(b.i, b.n, L);
  const slot = slotXY(b.slot, b.binCount, b.color, L);
  if (t <= b.release) return { ...home, moving: false };
  if (t >= b.arrive) {
    const dt = t - b.arrive;
    const bounce = Math.abs(Math.sin(Math.min(dt, 0.34) * 16)) * Math.exp(-dt * 7) * L.ballR * 0.42;
    return { x: slot.x, y: slot.y - bounce, moving: false };
  }
  if (path === "spiral") {
    const travel = Math.max(0.2, b.arrive - b.release - b.wait);
    const before = travel * 0.45;
    let s: number;
    if (t < b.release + before) s = 0.45 * ((t - b.release) / before);
    else if (t < b.release + before + b.wait) s = 0.45;
    else s = 0.45 + 0.55 * ((t - b.release - before - b.wait) / Math.max(0.05, travel - before));
    s = clamp(s, 0, 1);
    const on = spiralPoint(s, b.color, L);
    const enter = smooth(clamp(s / 0.14, 0, 1));
    const dive = smooth(clamp((s - 0.78) / 0.22, 0, 1));
    return {
      x: lerp(lerp(home.x, on.x, enter), slot.x, dive),
      y: lerp(lerp(home.y, on.y, enter), slot.y, dive),
      moving: true,
    };
  }
  const lane = laneX(b.color, L);
  const dropEnd = b.release + b.toGate;
  const holdEnd = dropEnd + b.wait;
  if (t < dropEnd) {
    const p = easeIn((t - b.release) / Math.max(0.05, b.toGate));
    return { x: lerp(home.x, lane, p), y: lerp(home.y, L.gateY, p), moving: true };
  }
  if (t < holdEnd) {
    return { x: lane, y: L.gateY + Math.sin((t - dropEnd) * 16) * L.ballR * 0.05, moving: false };
  }
  const p = smooth((t - holdEnd) / Math.max(0.05, b.arrive - holdEnd));
  return {
    x: lerp(lane, slot.x, p),
    y: lerp(L.gateY, slot.y, easeIn(p)) - Math.sin(p * Math.PI) * L.ballR * 0.5,
    moving: true,
  };
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hue: [number, number, number], alpha: number, shadow: boolean) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.9, r * 0.7, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.38, r * 0.08, x, y, r);
  g.addColorStop(0, hsl(hue, 16, 1));
  g.addColorStop(0.55, hsl(hue, 0, 1));
  g.addColorStop(1, hsl(hue, -16, 1));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.32, y - r * 0.34, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.78)";
  ctx.fill();
  ctx.restore();
}

function drawMachine(
  ctx: CanvasRenderingContext2D,
  u: number,
  t: number,
  L: Layout,
  path: PathKind,
  gate: Gate,
  balls: Ball[],
  palInk: string,
  palLine: string,
  palAccent: string,
) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.04)";
  roundRect(ctx, L.margin - 8 * u, L.hopper.y - 10 * u, L.innerW + 16 * u, L.binTop + L.binH - L.hopper.y + 18 * u, 18 * u);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,.32)";
  roundRect(ctx, L.hopper.x, L.hopper.y, L.hopper.w, L.hopper.h, 14 * u);
  ctx.fill();
  ctx.strokeStyle = hexA(palLine, 0.85);
  ctx.lineWidth = 2 * u;
  ctx.stroke();

  if (path === "straight") {
    ctx.beginPath();
    ctx.moveTo(L.hopper.x + 8 * u, L.hopper.y + L.hopper.h);
    ctx.lineTo(L.margin + L.innerW * 0.08, L.trackTop);
    ctx.moveTo(L.hopper.x + L.hopper.w - 8 * u, L.hopper.y + L.hopper.h);
    ctx.lineTo(L.margin + L.innerW * 0.92, L.trackTop);
    ctx.strokeStyle = hexA(palLine, 0.45);
    ctx.stroke();
    for (let c = 0; c < L.bins; c++) {
      const x = L.margin + c * L.binW;
      const hue = binHue(c);
      const g = ctx.createLinearGradient(0, L.trackTop, 0, L.trackBot);
      g.addColorStop(0, hsl(hue, 0, 0.04));
      g.addColorStop(1, hsl(hue, 0, 0.22));
      ctx.fillStyle = g;
      ctx.fillRect(x + u, L.trackTop, L.binW - 2 * u, L.trackBot - L.trackTop);
      if (c > 0) {
        ctx.strokeStyle = hexA(palLine, 0.28);
        ctx.lineWidth = 1.5 * u;
        ctx.beginPath();
        ctx.moveTo(x, L.trackTop);
        ctx.lineTo(x, L.trackBot);
        ctx.stroke();
      }
    }
  } else {
    ctx.beginPath();
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const p = railPoint((i / steps) * 0.9, L);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = hexA(palLine, 0.75);
    ctx.lineWidth = Math.max(6 * u, L.ballR * 0.85);
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = hexA(palInk, 0.25);
    ctx.lineWidth = Math.max(2 * u, L.ballR * 0.2);
    ctx.stroke();
  }

  if (gate === "fixed" && path === "straight") {
    for (let c = 0; c < L.bins; c++) {
      let open = 0;
      for (const b of balls) {
        if (b.color !== c) continue;
        const pass = b.release + b.toGate;
        const dt = t - pass;
        if (dt > -0.05 && dt < b.wait + 0.2) open = Math.max(open, 1);
      }
      const hue = binHue(c);
      ctx.save();
      ctx.translate(laneX(c, L), L.gateY);
      ctx.rotate(-open * 1.2);
      ctx.fillStyle = hsl(hue, 6, 0.95);
      roundRect(ctx, -L.binW * 0.32, -4 * u, L.binW * 0.64, 8 * u, 3 * u);
      ctx.fill();
      ctx.restore();
    }
  }

  if (gate === "moving") {
    const x = gateCenterX(t, L);
    const y = path === "spiral" ? L.cy : L.gateY;
    const mouth = Math.max(L.binW * 0.48, L.ballR * 2.5);
    const bar = 7 * u;
    const left = L.margin;
    const right = L.margin + L.innerW;
    ctx.fillStyle = hexA(palInk, 0.92);
    ctx.fillRect(left, y - bar / 2, Math.max(0, x - mouth / 2 - left), bar);
    ctx.fillRect(Math.min(right, x + mouth / 2), y - bar / 2, Math.max(0, right - (x + mouth / 2)), bar);
    ctx.strokeStyle = palAccent;
    ctx.lineWidth = 2 * u;
    ctx.strokeRect(x - mouth / 2, y - bar, mouth, bar * 2);
  }

  for (let c = 0; c < L.bins; c++) {
    const x = L.margin + c * L.binW;
    const hue = binHue(c);
    const arrived = balls.filter((b) => b.color === c && t >= b.arrive - 0.02).length;
    ctx.fillStyle = hsl(hue, -10, 0.2);
    roundRect(ctx, x + 3 * u, L.binTop, L.binW - 6 * u, L.binH, 12 * u);
    ctx.fill();
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = hsl(hue, 4, arrived >= balls.filter((b) => b.color === c).length && balls.length ? 0.95 : 0.55);
    ctx.stroke();
    ctx.font = `700 ${Math.max(11, 13 * u)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = hexA(palInk, 0.92);
    ctx.fillText(String(arrived), x + L.binW / 2, L.binTop - Math.max(12 * u, L.ballR * 0.85));
  }
  ctx.restore();
}

function readKind(p: Record<string, ParamValue>): { path: PathKind; gate: Gate; balls: number; bins: number; hold: number } {
  const bins = clamp(Math.round(Number(p.bins) || 4), 2, 6);
  const balls = clamp(Math.round(Number(p.balls) || 16), bins, 32);
  const path: PathKind = p.path === "spiral" ? "spiral" : "straight";
  const gate: Gate = p.gate === "fixed" || p.gate === "moving" ? p.gate : "none";
  const hold = clamp(Number(p.hold) || 1, 0.3, 2.5);
  return { path, gate, balls, bins, hold };
}

export const ballSort: SceneDef = {
  id: "ball-sort",
  name: "分球机",
  tagline: "彩球掉进盒子，按颜色分好",
  desc: "混在一起的彩球掉进分球机，最后按颜色进盒子。默认 16 球 4 盒、直道、没有门。这是编排出来的分拣，不是真实碰撞，球一定会分对。成片有多长由乐谱决定；模板「16球4盒」用一段没有声音的乐谱定在约 14 秒，分完再停约 1 秒。螺旋和移动门是变体，不是默认。",
  params: [
    { key: "balls", label: "球数", type: "number", min: 8, max: 32, step: 1, default: 16 },
    { key: "bins", label: "盒子数", type: "number", min: 2, max: 6, step: 1, default: 4 },
    {
      key: "path",
      label: "路径",
      type: "select",
      default: "straight",
      options: [
        { value: "straight", label: "直道" },
        { value: "spiral", label: "螺旋" },
      ],
    },
    {
      key: "gate",
      label: "门",
      type: "select",
      default: "none",
      options: [
        { value: "none", label: "无门" },
        { value: "fixed", label: "固定门" },
        { value: "moving", label: "移动门" },
      ],
      hint: "默认无门。螺旋和移动门更会循环，但人更容易划走。",
    },
    { key: "hold", label: "分完停住", type: "number", min: 0.4, max: 2.5, step: 0.1, default: 1, hint: "秒。总时长仍由乐谱决定。" },
  ],
  draw({ ctx, w, h, u, t, tl, cfg, pal, p }) {
    const kind = readKind(p);
    const hold = Math.min(kind.hold, Math.max(0.3, tl.duration - 1.3));
    const t1 = Math.max(1.2, tl.duration - hold);
    const per = Math.ceil(kind.balls / kind.bins);
    const L = layoutOf(w, h, u, kind.bins, per);
    const seed =
      kind.balls * 10007 + kind.bins * 97 + (kind.path === "spiral" ? 501 : 3) + (kind.gate === "fixed" ? 809 : kind.gate === "moving" ? 1301 : 11);
    const balls = planBalls(kind.balls, kind.bins, kind.path, kind.gate, seed, Math.min(0.4, t1 * 0.08), t1, L);

    drawBackground(ctx, w, h, pal);
    drawMachine(ctx, u, t, L, kind.path, kind.gate, balls, pal.ink, pal.line, pal.accent);

    const placed = balls.map((b) => ({ b, pt: place(b, t, L, kind.path) })).sort((a, b) => a.pt.y - b.pt.y);
    for (const { b, pt } of placed) {
      const hue = binHue(b.color);
      if (pt.moving) {
        for (let k = 3; k >= 1; k--) {
          const tt = t - k * 0.04;
          if (tt <= b.release) continue;
          const g = place(b, tt, L, kind.path);
          drawBall(ctx, g.x, g.y, L.ballR * (1 - k * 0.06), hue, 0.1, false);
        }
      }
      drawBall(ctx, pt.x, pt.y, L.ballR, hue, 1, true);
      const age = t - b.arrive;
      if (age >= 0 && age < 0.28) {
        const rand = rng(b.i * 97 + b.color * 13 + 5);
        for (let k = 0; k < 3; k++) {
          const ang = rand() * Math.PI * 2;
          const dist = age * L.ballR * 7 * (0.45 + rand());
          ctx.fillStyle = hsl(hue, 8, 0.45 * (1 - age / 0.28));
          ctx.beginPath();
          ctx.arc(pt.x + Math.cos(ang) * dist, pt.y + Math.sin(ang) * dist * 0.6, Math.max(1, L.ballR * 0.12), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    drawVignette(ctx, w, h, 0.38);
    drawOverlay(ctx, w, h, u, t, tl, cfg, pal);
  },
};
