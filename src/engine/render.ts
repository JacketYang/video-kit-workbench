import type { Aspect, ProjectConfig, Timeline } from "./types";
import { getScene } from "./scenes";
import { getPalette } from "./palettes";

export function sizeFor(aspect: Aspect, longEdge: number) {
  if (aspect === "1:1") return { w: longEdge, h: longEdge };
  const short = Math.round((longEdge * 9) / 16 / 2) * 2;
  return aspect === "9:16" ? { w: short, h: longEdge } : { w: longEdge, h: short };
}

/** 渲染单帧。预览、封面、导出共用这一个入口，保证所见即所得。 */
export function renderFrame(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, tl: Timeline, cfg: ProjectConfig) {
  const scene = getScene(cfg.scene.type);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "butt";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  try {
    scene.draw({ ctx, w, h, u: Math.min(w, h) / 540, t, tl, cfg, pal: getPalette(cfg.scene.palette), p: cfg.scene.params });
  } finally {
    ctx.restore();
  }
}
