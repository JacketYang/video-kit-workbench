import type { SceneDef } from "../types";
import { FONT, clamp, drawBackground, drawOverlay, drawVignette, hash01, hexA, hsl, idxAt, lerp, noteHsl, rng, roundRect, smooth } from "../util";

/** 玩法 A：泡泡沿着琴键一路弹下去，落到哪个键就响哪个音。 */
export const bubbleKeys: SceneDef = {
  id: "bubble-keys",
  name: "泡泡琴键",
  tagline: "泡泡在彩色木琴键上一路弹跳",
  desc: "每个音符对应一块琴键，泡泡落到键上的瞬间发声；落地有涟漪、气泡粒子，歌词字会在键下亮起。",
  params: [
    { key: "ballSize", label: "泡泡大小", type: "number", min: 0.5, max: 2, step: 0.05, default: 1 },
    { key: "bounce", label: "弹跳高度", type: "number", min: 0.4, max: 2, step: 0.05, default: 1 },
    { key: "keyWidth", label: "琴键宽度", type: "number", min: 0.6, max: 1.6, step: 0.05, default: 1 },
    { key: "spacing", label: "琴键间距", type: "number", min: 0.7, max: 1.6, step: 0.05, default: 1 },
    { key: "wobble", label: "琴键歪斜", type: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: "trail", label: "运动拖尾", type: "boolean", default: true },
    { key: "particles", label: "落地粒子", type: "boolean", default: true },
    { key: "lyrics", label: "显示歌词", type: "boolean", default: true },
  ],
  draw({ ctx, w, h, u, t, tl, cfg, pal, p }) {
    const ev = tl.events;
    const n = ev.length;
    drawBackground(ctx, w, h, pal);
    if (!n) {
      drawOverlay(ctx, w, h, u, t, tl, cfg, pal);
      return;
    }
    const ballSize = Number(p.ballSize), bounce = Number(p.bounce), wob = Number(p.wobble);
    const r = 30 * u * ballSize;
    const kh = 36 * u, kw = 118 * u * Number(p.keyWidth), step = 132 * u * Number(p.spacing);
    const range = tl.maxMidi - tl.minMidi;
    const span = w * 0.62;
    const kx = (i: number) => (range === 0 ? 0 : ((ev[i].midi - tl.minMidi) / range - 0.5) * span);
    const ky = (i: number) => i * step;
    const contactY = (i: number) => ky(i) - kh / 2 - r;
    const startY = contactY(0) - 560 * u;
    const hop = (dt: number) => clamp((1800 * u * dt * dt) / 8, 34 * u, 190 * u) * bounce;

    const ball = (tt: number, arc: boolean) => {
      const k = idxAt(ev, tt);
      if (k < 0) {
        const tau = clamp(tt / ev[0].t, 0, 1);
        return { x: kx(0), y: lerp(startY, contactY(0), tau * tau) };
      }
      if (k < n - 1) {
        const dt = ev[k + 1].t - ev[k].t;
        const tau = (tt - ev[k].t) / dt;
        const x = lerp(kx(k), kx(k + 1), smooth(tau) * 0.6 + tau * 0.4);
        let y = lerp(contactY(k), contactY(k + 1), tau);
        if (arc) y -= 4 * hop(dt) * tau * (1 - tau);
        return { x, y };
      }
      const s = tt - ev[k].t;
      const y = contactY(k) - (arc ? Math.abs(Math.sin((Math.PI * s) / 0.42)) * 46 * u * bounce * Math.exp(-s * 2.4) : 0);
      return { x: kx(k), y };
    };

    // 摄像机：平滑跟随基线(不含弹跳)
    let cx = 0, cy = 0;
    for (let j = 0; j < 7; j++) {
      const b = ball(t + (j - 3) * 0.15, false);
      cx += b.x;
      cy += b.y;
    }
    const camX = (cx / 7) * 0.55, camY = cy / 7;
    const X = (wx: number) => w / 2 + wx - camX;
    const Y = (wy: number) => h * 0.44 + wy - camY;

    // 背景散景(视差)
    ctx.save();
    for (let j = 0; j < 14; j++) {
      const rg = rng(j * 13 + 5);
      const bx = rg() * w, rad = (30 + rg() * 90) * u, par = 0.15 + rg() * 0.2;
      const H = h * 1.6;
      const yy = ((((rg() * H - camY * par) % H) + H) % H) - h * 0.3;
      ctx.fillStyle = hexA("#ffffff", 0.03 + rg() * 0.04);
      ctx.beginPath();
      ctx.arc(bx, yy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const idx = idxAt(ev, t);
    const i0 = Math.max(0, Math.floor((camY - h * 0.55) / step) - 1);
    const i1 = Math.min(n - 1, Math.ceil((camY + h * 0.65) / step) + 1);

    // 琴键
    for (let i = i0; i <= i1; i++) {
      const e = ev[i];
      const col = noteHsl(pal, e.midi);
      const s = t - e.t;
      const hit = s >= 0;
      const fl = hit ? Math.exp(-s * 3.2) : 0;
      let ang = (hash01(i + 3) - 0.5) * 0.5 * wob;
      if (hit) ang += 0.14 * Math.sin(s * 34) * Math.exp(-s * 6) * (hash01(i) > 0.5 ? 1 : -1);
      const sx = X(kx(i));
      const sy = Y(ky(i)) + (hit ? 7 * u * Math.exp(-s * 12) : 0);
      const dim = hit ? 1 : 0.7;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = hsl(col, -38, dim);
      roundRect(ctx, -kw / 2, -kh / 2 + 9 * u, kw, kh, 10 * u);
      ctx.fill();
      const g = ctx.createLinearGradient(0, -kh / 2, 0, kh / 2);
      g.addColorStop(0, hsl(col, 8 + fl * 14, dim));
      g.addColorStop(1, hsl(col, -8, dim));
      ctx.fillStyle = g;
      roundRect(ctx, -kw / 2, -kh / 2, kw, kh, 10 * u);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.25)";
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sgn * kw * 0.3, 0, 5 * u, 3 * u, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (fl > 0.02) {
        ctx.globalCompositeOperation = "lighter";
        const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, kw * 0.85);
        g2.addColorStop(0, hsl(col, 0, fl * 0.35));
        g2.addColorStop(1, hsl(col, 0, 0));
        ctx.fillStyle = g2;
        ctx.fillRect(-kw, -kw, kw * 2, kw * 2);
      }
      ctx.restore();
    }

    // 涟漪 + 粒子
    for (let k = Math.max(0, idx - 7); k <= idx; k++) {
      if (k < 0 || k < i0 - 8) continue;
      const e = ev[k];
      const s = t - e.t;
      if (s < 0 || s > 1.3) continue;
      const col = noteHsl(pal, e.midi);
      const hx = X(kx(k)), hy = Y(ky(k)) - kh / 2;
      if (s < 0.7) {
        ctx.strokeStyle = hsl(col, 6, 0.65 * (1 - s / 0.7));
        ctx.lineWidth = 2.5 * u;
        ctx.beginPath();
        ctx.ellipse(hx, hy, 20 * u + s * 150 * u, (20 * u + s * 150 * u) * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (p.particles) {
        const rg = rng(k * 31 + 7);
        for (let j = 0; j < 10; j++) {
          const a = -Math.PI / 2 + (rg() - 0.5) * 2.6;
          const sp = (90 + rg() * 170) * u;
          const px = hx + Math.cos(a) * sp * s;
          const py = hy + Math.sin(a) * sp * s + 260 * u * s * s * 0.5;
          const al = clamp(1 - s / 1.1, 0, 1);
          const rad = (3 + rg() * 6) * u;
          if (j % 3 === 0) {
            ctx.fillStyle = hsl(col, 8, al);
            ctx.font = `700 ${rad * 4}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.fillText("♪", px, py);
          } else {
            ctx.strokeStyle = hsl(col, 10, al * 0.9);
            ctx.lineWidth = 1.6 * u;
            ctx.beginPath();
            ctx.arc(px, py, rad, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }

    // 歌词
    if (p.lyrics) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = i0; i <= i1; i++) {
        const e = ev[i];
        if (!e.lyric) continue;
        const s = t - e.t;
        const col = noteHsl(pal, e.midi);
        const pop = s >= 0 ? 1 + 0.35 * Math.exp(-s * 8) : 1;
        const al = s < 0 ? 0.3 : clamp(0.5 + 0.5 * Math.exp(-s * 1.2), 0.25, 1);
        ctx.font = `700 ${40 * u * pop}px ${FONT}`;
        ctx.fillStyle = s < 0 ? hexA(pal.ink, al) : hsl(col, 6, al);
        ctx.fillText(e.lyric, X(kx(i)), Y(ky(i)) + kh / 2 + 36 * u);
      }
      ctx.textBaseline = "alphabetic";
    }

    // 氛围光
    const bl = ball(t, true);
    const bx = X(bl.x), by = Y(bl.y);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const amb = ctx.createRadialGradient(bx, by, 0, bx, by, r * 5);
    amb.addColorStop(0, hexA(pal.accent, 0.12));
    amb.addColorStop(1, hexA(pal.accent, 0));
    ctx.fillStyle = amb;
    ctx.fillRect(bx - r * 5, by - r * 5, r * 10, r * 10);
    ctx.restore();

    // 拖尾
    if (p.trail) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let j = 1; j <= 18; j++) {
        const b = ball(t - j * 0.02, true);
        ctx.fillStyle = hexA(pal.accent, (1 - j / 19) * 0.09);
        ctx.beginPath();
        ctx.arc(X(b.x), Y(b.y), Math.max(1, r * (1 - j / 22)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 泡泡
    const k = idxAt(ev, t);
    const sq = k >= 0 ? Math.exp(-(t - ev[k].t) * 18) * 0.22 : 0;
    ctx.save();
    ctx.translate(bx, by + sq * r * 0.6);
    ctx.scale(1 + sq * 1.2, 1 - sq * 1.2);
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    body.addColorStop(0, "rgba(255,255,255,.30)");
    body.addColorStop(0.65, "rgba(255,255,255,.05)");
    body.addColorStop(1, hexA(pal.accent2, 0.38));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    const ring = ctx.createLinearGradient(-r, -r, r, r);
    ring.addColorStop(0, "#9be7ff");
    ring.addColorStop(0.5, "#ff9ee0");
    ring.addColorStop(1, "#ffe58a");
    ctx.strokeStyle = ring;
    ctx.lineWidth = 3 * u;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,160,230,.28)";
    ctx.lineWidth = r * 0.28;
    ctx.beginPath();
    ctx.arc(r * 0.18, r * 0.2, r * 0.92, 0.2, 2.2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.28, r * 0.15, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawVignette(ctx, w, h, 0.35);
    drawOverlay(ctx, w, h, u, t, tl, cfg, pal);
  },
};
