import type { SceneDef } from "../types";
import { clamp, drawBackground, drawOverlay, drawVignette, hexA, idxAt, lerp, rng, smooth } from "../util";

const PC_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
/** 音名 → 五线谱上的“级”(C4 = 28)，每升一级就是线到间的一格 */
const dIdx = (m: number) => (Math.floor(m / 12) - 1) * 7 + PC_STEP[((m % 12) + 12) % 12];

/** 玩法 B：五线谱倾斜铺开，音符是发光的点，一颗流星在音符之间跳跃。 */
export const glowStaff: SceneDef = {
  id: "glow-staff",
  name: "五线谱流光",
  tagline: "光点在倾斜的五线谱上依次点亮",
  desc: "透视五线谱向远处铺开，音符被流星依次点亮，命中时迸出火花；底部有随音符起伏的频谱条。",
  params: [
    { key: "speed", label: "滚动速度", type: "number", min: 0.5, max: 2, step: 0.05, default: 1 },
    { key: "tilt", label: "透视倾角", type: "number", min: 0, max: 60, step: 1, default: 38, hint: "度" },
    { key: "roll", label: "画面旋转", type: "number", min: -45, max: 0, step: 1, default: -24, hint: "度" },
    { key: "glow", label: "光晕强度", type: "number", min: 0, max: 1, step: 0.05, default: 0.7 },
    { key: "comet", label: "流星拖尾", type: "boolean", default: true },
    { key: "sparkles", label: "漂浮星点", type: "boolean", default: true },
    { key: "spectrum", label: "底部频谱", type: "boolean", default: true },
  ],
  draw({ ctx, w, h, u, t, tl, cfg, pal, p }) {
    const ev = tl.events;
    const n = ev.length;
    drawBackground(ctx, w, h, pal);
    const D = 1300;
    const k = u * (w > h ? 1.5 : 1);
    const a = (Number(p.tilt) * Math.PI) / 180;
    const roll = (Number(p.roll) * Math.PI) / 180;
    const pps = 170 * Number(p.speed);
    const glow = Number(p.glow);
    const ox = w * (w > h ? 0.3 : 0.34), oy = h * 0.55;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const proj = (X: number, Y: number) => {
      const z = D + X * Math.sin(a);
      const f = D / z;
      const px = X * Math.cos(a) * f, py = Y * f;
      return { x: ox + (px * cr - py * sr) * k, y: oy + (px * sr + py * cr) * k, s: f * k };
    };

    // 暖色光斑
    const spot = ctx.createRadialGradient(ox, oy, 0, ox, oy, Math.max(w, h) * 0.7);
    spot.addColorStop(0, hexA(pal.accent2, 0.16 * (0.5 + glow)));
    spot.addColorStop(1, hexA(pal.accent2, 0));
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, w, h);

    if (!n) {
      drawOverlay(ctx, w, h, u, t, tl, cfg, pal);
      return;
    }
    const ds = ev.map((e) => dIdx(e.midi));
    const minD = Math.min(...ds), maxD = Math.max(...ds);
    const dMid = Math.round((minD + maxD) / 2);
    const Yp = (d: number) => -(d - dMid) * 22;
    // 线位
    const lines: number[] = [30, 32, 34, 36, 38];
    if (minD < 28) for (let d = Math.max(18, minD - (minD % 2)); d <= 26; d += 2) lines.push(d);
    for (let d = 40; d <= maxD + (maxD % 2); d += 2) lines.push(d);
    for (let d = 16; d >= minD - 1 && d >= 2; d -= 2) lines.push(d);
    lines.sort((x, y) => x - y);
    const lineSet = new Set(lines);
    const lo = lines[0], hi = lines[lines.length - 1];
    const ledgers = (d: number) => {
      const out: number[] = [];
      if (d > hi) for (let e = hi + 2; e <= d; e += 2) out.push(e);
      else if (d < lo) for (let e = lo - 2; e >= d - 1; e -= 2) out.push(e);
      else if (!lineSet.has(28) && d >= 27 && d <= 29 && lo < 28 && hi > 28) out.push(28);
      return out.filter((e) => !lineSet.has(e));
    };

    // 谱面(半透明平面)
    const XL = -900, XR = 1300;
    const yTop = Yp(hi) - 40, yBot = Yp(lo) + 40;
    const c1 = proj(XL, yTop), c2 = proj(XR, yTop), c3 = proj(XR, yBot), c4 = proj(XL, yBot);
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.lineTo(c4.x, c4.y);
    ctx.closePath();
    const plate = ctx.createLinearGradient(c1.x, c1.y, c3.x, c3.y);
    plate.addColorStop(0, hexA(pal.line, 0.0));
    plate.addColorStop(0.5, hexA(pal.line, 0.1));
    plate.addColorStop(1, hexA(pal.line, 0.0));
    ctx.fillStyle = plate;
    ctx.fill();

    // 谱线
    ctx.lineCap = "round";
    for (const d of lines) {
      const A = proj(XL, Yp(d)), B = proj(XR, Yp(d));
      const g = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
      g.addColorStop(0, hexA(pal.line, 0));
      g.addColorStop(0.18, hexA(pal.line, 0.7));
      g.addColorStop(0.8, hexA(pal.line, 0.5));
      g.addColorStop(1, hexA(pal.line, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.4 * u;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    }

    // 星点
    if (p.sparkles) {
      for (let j = 0; j < 70; j++) {
        const r = rng(j * 97 + 3);
        const sx = r() * w, sy = r() * h, v = (8 + r() * 18) * u;
        const yy = (((sy - t * v) % h) + h) % h;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.8 + r() * 1.6) + r() * 6));
        ctx.fillStyle = `rgba(255,240,215,${(tw * 0.65).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, yy, (0.8 + r() * 2.2) * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 音符(远→近)
    for (let i = n - 1; i >= 0; i--) {
      const e = ev[i];
      const X = (e.t - t) * pps;
      if (X < XL || X > XR) continue;
      const d = ds[i];
      const P = proj(X, Yp(d));
      const s = t - e.t;
      const flash = s >= 0 ? Math.exp(-s * 2.6) : 0;
      const played = s >= 0 ? smooth(s / 0.9) : 0;
      const far = 1 - clamp(X / XR, 0, 1) * 0.45;
      const rx = 21 * P.s, ry = 14.5 * P.s;
      // 加线
      ctx.strokeStyle = hexA(pal.line, 0.65 * far);
      ctx.lineWidth = 2.2 * u;
      for (const le of ledgers(d)) {
        const A = proj(X - 34, Yp(le)), B = proj(X + 34, Yp(le));
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
      // 光晕
      if (glow > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const R = 38 * P.s * (1.2 + flash * 2.4);
        const g = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, R);
        const aa = glow * (0.5 * (1 - played * 0.8) * far + flash * 0.7);
        g.addColorStop(0, hexA(flash > 0.1 ? pal.accent : "#fff3d6", aa));
        g.addColorStop(1, hexA(pal.accent, 0));
        ctx.fillStyle = g;
        ctx.fillRect(P.x - R, P.y - R, R * 2, R * 2);
        ctx.restore();
      }
      // 符干
      const up = d < 34;
      const sxp = P.x + (up ? 1 : -1) * rx * 0.92;
      ctx.strokeStyle = `rgba(12,7,4,${(0.85 * (1 - played * 0.55)).toFixed(3)})`;
      ctx.lineWidth = 3.4 * P.s;
      ctx.beginPath();
      ctx.moveTo(sxp, P.y);
      ctx.lineTo(sxp, P.y + (up ? -1 : 1) * 88 * P.s);
      ctx.stroke();
      // 符头
      ctx.save();
      ctx.translate(P.x, P.y);
      ctx.rotate(-0.35 + roll * 0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      const body = 1 - played * 0.62;
      ctx.fillStyle = `rgba(255,252,244,${(body * far).toFixed(3)})`;
      ctx.fill();
      if (flash > 0.05) {
        ctx.fillStyle = hexA(pal.accent, flash * 0.9);
        ctx.fill();
      }
      ctx.restore();
    }

    // 流星
    const ypos = (tt: number) => {
      const kk = idxAt(ev, tt);
      if (kk < 0) {
        const tau = clamp(tt / ev[0].t, 0, 1);
        return Yp(ds[0]) - 320 * (1 - tau) * (1 - tau);
      }
      if (kk < n - 1) {
        const dt = ev[kk + 1].t - ev[kk].t;
        const tau = (tt - ev[kk].t) / dt;
        return lerp(Yp(ds[kk]), Yp(ds[kk + 1]), smooth(tau)) - clamp(dt * 100, 16, 80) * 4 * tau * (1 - tau);
      }
      const s = tt - ev[kk].t;
      return Yp(ds[kk]) - Math.abs(Math.sin((Math.PI * s) / 0.4)) * 30 * Math.exp(-s * 2.5);
    };
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (p.comet) {
      const NJ = 24;
      let prev = proj(0, ypos(t));
      for (let j = 1; j <= NJ; j++) {
        const tt = t - j * 0.022;
        const pt = proj(-j * 0.022 * pps, ypos(tt));
        const f = 1 - j / NJ;
        ctx.strokeStyle = `rgba(255,${Math.round(170 + 70 * f)},${Math.round(60 + 90 * f)},${(Math.pow(f, 1.4) * 0.9).toFixed(3)})`;
        ctx.lineWidth = lerp(1.5, 15, f) * pt.s;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        prev = pt;
      }
    }
    const H = proj(0, ypos(t));
    const hr = 30 * H.s;
    const hg = ctx.createRadialGradient(H.x, H.y, 0, H.x, H.y, hr);
    hg.addColorStop(0, "rgba(255,255,255,1)");
    hg.addColorStop(0.3, hexA(pal.accent, 0.9));
    hg.addColorStop(1, hexA(pal.accent2, 0));
    ctx.fillStyle = hg;
    ctx.fillRect(H.x - hr, H.y - hr, hr * 2, hr * 2);

    // 命中火花
    const idx = idxAt(ev, t);
    for (let q = Math.max(0, idx - 4); q <= idx; q++) {
      if (q < 0) continue;
      const e = ev[q];
      const s = t - e.t;
      if (s > 0.8) continue;
      const P = proj((e.t - t) * pps, Yp(ds[q]));
      const rg = rng(q * 53 + 11);
      for (let j = 0; j < 12; j++) {
        const ang = rg() * Math.PI * 2, sp = (40 + rg() * 120) * k;
        const px = P.x + Math.cos(ang) * sp * s, py = P.y + Math.sin(ang) * sp * s + 60 * u * s * s;
        ctx.fillStyle = hexA(j % 2 ? pal.accent : "#ffffff", (1 - s / 0.8) * 0.9);
        ctx.beginPath();
        ctx.arc(px, py, (1.2 + rg() * 2.2) * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 频谱
    if (p.spectrum) {
      const N = w > h ? 72 : 44;
      const bw = (w - 56 * u) / N, base = h - 26 * u, maxH = 70 * u;
      const range = Math.max(1, tl.maxMidi - tl.minMidi);
      for (let b = 0; b < N; b++) {
        let v = 0.04 + 0.03 * (Math.sin(b * 1.7 + t * 4) * 0.5 + 0.5);
        for (let q = Math.max(0, idx - 8); q <= idx; q++) {
          if (q < 0) continue;
          const env = Math.exp(-(t - ev[q].t) * 3.4);
          if (env < 0.02) continue;
          const c = ((ev[q].midi - tl.minMidi) / range) * 0.55 * N + 0.1 * N;
          v += env * (Math.exp(-((b - c) ** 2) / 9.7) + 0.45 * Math.exp(-((b - (c * 1.6 + 3)) ** 2) / 15.7)) * 0.95;
        }
        v = Math.min(1, v);
        ctx.fillStyle = `hsla(${((b / N) * 300).toFixed(0)},85%,60%,0.9)`;
        ctx.fillRect(28 * u + b * bw, base - v * maxH, Math.max(1, bw - 2 * u), v * maxH);
      }
    }

    drawVignette(ctx, w, h, 0.5);
    drawOverlay(ctx, w, h, u, t, tl, cfg, pal);
  },
};
