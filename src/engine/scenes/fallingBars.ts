import type { SceneDef } from "../types";
import { FONT, clamp, drawBackground, drawOverlay, drawVignette, hexA, hsl, idxAt, noteHsl, rng, roundRect } from "../util";

const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

/** 玩法 C：音条从天而降，落在钢琴键盘上发声（经典的“瀑布琴谱”）。 */
export const fallingBars: SceneDef = {
  id: "falling-bars",
  name: "下落音条",
  tagline: "彩色音条落在钢琴键上",
  desc: "音条的长度就是音符的时值；条落到键盘的瞬间发声，琴键亮起并放出光柱与火花，歌词字随之升起。",
  params: [
    { key: "fall", label: "下落时间", type: "number", min: 1, max: 4, step: 0.1, default: 2.2, hint: "秒" },
    { key: "glow", label: "光晕强度", type: "number", min: 0, max: 1, step: 0.05, default: 0.7 },
    { key: "keyboard", label: "显示键盘", type: "boolean", default: true },
    { key: "particles", label: "命中火花", type: "boolean", default: true },
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
    let lo = tl.minMidi - 1, hi = tl.maxMidi + 1;
    while (isBlack(lo)) lo--;
    while (isBlack(hi)) hi++;
    while (hi - lo < 16) {
      lo--;
      while (isBlack(lo)) lo--;
      hi++;
      while (isBlack(hi)) hi++;
    }
    const whites: number[] = [];
    for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
    const wIndex = (m: number) => whites.indexOf(m);
    const margin = w * 0.03;
    const ww = (w - margin * 2) / whites.length;
    const cxOf = (m: number) => (isBlack(m) ? margin + (wIndex(m - 1) + 1) * ww : margin + wIndex(m) * ww + ww / 2);
    const showKb = Boolean(p.keyboard);
    const kbH = showKb ? Math.min(h * 0.2, 190 * u) : 0;
    const kbTop = h - kbH - 22 * u;
    const pps = (kbTop * 0.95) / Number(p.fall);
    const glow = Number(p.glow);
    const idx = idxAt(ev, t);

    // 网格
    ctx.strokeStyle = "rgba(255,255,255,.05)";
    ctx.lineWidth = 1 * u;
    for (let i = 0; i <= whites.length; i++) {
      ctx.beginPath();
      ctx.moveTo(margin + i * ww, 0);
      ctx.lineTo(margin + i * ww, kbTop);
      ctx.stroke();
    }

    // 音条
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, kbTop);
    ctx.clip();
    for (let i = 0; i < n; i++) {
      const e = ev[i];
      const bottom = kbTop - (e.t - t) * pps;
      const len = Math.max(e.dur * pps * 0.92, 28 * u);
      const top = bottom - len;
      if (top > kbTop || bottom < -10) {
        if (e.t - t > cfg.music.tail + 6) break;
        continue;
      }
      const col = noteHsl(pal, e.midi);
      const cx = cxOf(e.midi);
      const bw = ww * (isBlack(e.midi) ? 0.52 : 0.74);
      const active = t >= e.t && t <= e.t + e.dur;
      if (glow > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = hsl(col, 0, 0.16 * glow + (active ? 0.18 * glow : 0));
        roundRect(ctx, cx - bw / 2 - 5 * u, top - 5 * u, bw + 10 * u, len + 10 * u, 10 * u);
        ctx.fill();
        ctx.restore();
      }
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, hsl(col, 10, 1));
      g.addColorStop(1, hsl(col, -10, 1));
      ctx.fillStyle = g;
      roundRect(ctx, cx - bw / 2, top, bw, len, Math.min(bw / 2, 8 * u));
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.35)";
      roundRect(ctx, cx - bw / 2 + 2 * u, top + 2 * u, Math.max(2 * u, bw * 0.18), Math.max(2, len - 4 * u), 3 * u);
      ctx.fill();
      if (p.lyrics && e.lyric && top > 70 * u) {
        ctx.font = `700 ${Math.min(24 * u, ww * 0.9)}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillStyle = hexA(pal.ink, 0.8);
        ctx.fillText(e.lyric, cx, top - 8 * u);
      }
    }
    ctx.restore();

    // 键盘 + 命中状态
    const press = new Map<number, number>();
    for (let q = Math.max(0, idx - 10); q <= idx; q++) {
      if (q < 0) continue;
      const e = ev[q];
      const s = t - e.t;
      const amt = s <= e.dur ? 1 : Math.exp(-(s - e.dur) * 9);
      if (amt > 0.02) press.set(e.midi, Math.max(press.get(e.midi) ?? 0, amt));
    }
    if (showKb) {
      for (const m of whites) {
        const amt = press.get(m) ?? 0;
        const x = margin + wIndex(m) * ww;
        const col = noteHsl(pal, m);
        const g = ctx.createLinearGradient(0, kbTop, 0, kbTop + kbH);
        g.addColorStop(0, amt > 0 ? hsl(col, 2, 1) : "#fbfbfb");
        g.addColorStop(1, amt > 0 ? hsl(col, -12, 1) : "#d4d6dc");
        ctx.fillStyle = g;
        roundRect(ctx, x + 1 * u, kbTop + (amt > 0 ? 3 * u : 0), ww - 2 * u, kbH - (amt > 0 ? 3 * u : 0), 6 * u);
        ctx.fill();
      }
      for (let m = lo; m <= hi; m++) {
        if (!isBlack(m)) continue;
        const amt = press.get(m) ?? 0;
        const col = noteHsl(pal, m);
        ctx.fillStyle = amt > 0 ? hsl(col, -8, 1) : "#16181d";
        roundRect(ctx, cxOf(m) - ww * 0.3, kbTop, ww * 0.6, kbH * 0.62, 4 * u);
        ctx.fill();
      }
    }
    // 光柱
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [m, amt] of press) {
      const col = noteHsl(pal, m);
      const cx = cxOf(m);
      const g = ctx.createLinearGradient(0, kbTop, 0, kbTop - 220 * u);
      g.addColorStop(0, hsl(col, 0, 0.5 * amt * glow));
      g.addColorStop(1, hsl(col, 0, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - ww * 0.45, kbTop - 220 * u, ww * 0.9, 220 * u);
    }
    // 火花
    if (p.particles) {
      for (let q = Math.max(0, idx - 8); q <= idx; q++) {
        if (q < 0) continue;
        const e = ev[q];
        const s = t - e.t;
        if (s > 0.9) continue;
        const col = noteHsl(pal, e.midi);
        const rg = rng(q * 41 + 5);
        for (let j = 0; j < 9; j++) {
          const sp = (60 + rg() * 150) * u;
          const dx = (rg() - 0.5) * 90 * u;
          ctx.fillStyle = hsl(col, 8, clamp(1 - s / 0.9, 0, 1));
          ctx.beginPath();
          ctx.arc(cxOf(e.midi) + dx * s * 2, kbTop - sp * s + 160 * u * s * s, (1.5 + rg() * 2.5) * u, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // 升起的歌词
    if (p.lyrics) {
      ctx.textAlign = "center";
      for (let q = Math.max(0, idx - 4); q <= idx; q++) {
        if (q < 0) continue;
        const e = ev[q];
        const s = t - e.t;
        if (!e.lyric || s > 1.4) continue;
        const col = noteHsl(pal, e.midi);
        ctx.font = `700 ${46 * u}px ${FONT}`;
        ctx.fillStyle = hsl(col, 6, clamp(1 - s / 1.4, 0, 1));
        const x = clamp(cxOf(e.midi), margin + 24 * u, w - margin - 24 * u);
        ctx.fillText(e.lyric, x, kbTop - 40 * u - s * 100 * u);
      }
    }

    drawVignette(ctx, w, h, 0.4);
    drawOverlay(ctx, w, h, u, t, tl, cfg, pal);
  },
};
