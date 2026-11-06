import {
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  Input,
  BlobSource,
  ALL_FORMATS,
  Mp4OutputFormat,
  Output,
  canEncodeAudio,
  getFirstEncodableVideoCodec,
} from "mediabunny";
import { registerAacEncoder } from "@mediabunny/aac-encoder";
import type { ProjectConfig, Timeline } from "./types";
import { renderAudioBuffer, type Player } from "./audio";
import { renderFrame } from "./render";

/** 浏览器是否支持“逐帧离线渲染”导出（WebCodecs）。Chrome / Edge 桌面版均支持。 */
export function supportsOfflineExport(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof OfflineAudioContext !== "undefined" && typeof AudioEncoder !== "undefined";
}

export interface ExportInfo {
  videoCodec: string;
  audioCodec: string;
  duration: number;
  frames: number;
  w: number;
  h: number;
  fps: number;
}

let aacRegistered = false;
async function ensureAac() {
  if (await canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48000 })) return;
  if (!aacRegistered) {
    registerAacEncoder();
    aacRegistered = true;
  }
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * 逐帧离线导出（推荐）：
 *  - 画面：第 i 帧固定渲染 t = i / fps，不依赖 requestAnimationFrame，不会丢帧、不会错位；
 *  - 声音：OfflineAudioContext 一次性合成整首，再编码为 AAC；
 *  - 封装：标准 MP4（H.264 + AAC，moov 在文件头，所有播放器/剪辑软件/手机都能直接播放）。
 * 速度与实时无关：通常比歌曲时长快或相当，导出期间不会发出声音。
 */
export async function exportMp4(o: {
  cfg: ProjectConfig;
  tl: Timeline;
  w: number;
  h: number;
  onProgress: (p: number, stage: string) => void;
  aborted: () => boolean;
}): Promise<RecordResult & { info: ExportInfo }> {
  const { cfg, tl } = o;
  const w = Math.round(o.w / 2) * 2;
  const h = Math.round(o.h / 2) * 2;
  const fps = Math.max(1, Math.round(cfg.canvas.fps));
  const seconds = tl.duration;
  const frames = Math.max(1, Math.round(seconds * fps));
  const bitrate = Math.round(Math.min(16e6, Math.max(2.5e6, w * h * fps * 0.12)));

  const vcodec = await getFirstEncodableVideoCodec(["avc", "vp9", "av1", "hevc"], { width: w, height: h, bitrate, frameRate: fps });
  if (!vcodec) throw new Error("当前浏览器无法编码视频（缺少 H.264 编码器）。请用最新版 Chrome / Edge 桌面版，或降低分辨率再试。");
  await ensureAac();

  o.onProgress(0, "合成声音");
  const abuf = await renderAudioBuffer(tl, cfg.music.instrument, cfg.music.volume, seconds);
  if (o.aborted()) throw new Error("已取消");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false })!;

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const vsrc = new CanvasSource(canvas, { codec: vcodec, bitrate, keyFrameInterval: 2 });
  const asrc = new AudioBufferSource({ codec: "aac", bitrate: 160000 });
  output.addVideoTrack(vsrc, { frameRate: fps });
  output.addAudioTrack(asrc);
  await output.start();

  try {
    // 先写入音频（一整段），再逐帧写入画面
    await asrc.add(abuf);
    asrc.close();
    const dur = 1 / fps;
    for (let i = 0; i < frames; i++) {
      if (o.aborted()) throw new Error("已取消");
      const t = Math.min(i / fps, seconds);
      renderFrame(ctx, w, h, t, tl, cfg);
      await vsrc.add(i / fps, dur, i % (fps * 2) === 0 ? { keyFrame: true } : undefined);
      if (i % 4 === 0) {
        o.onProgress((i + 1) / frames, "渲染画面");
        await tick();
      }
    }
    vsrc.close();
    o.onProgress(1, "封装文件");
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }

  const buf = target.buffer;
  if (!buf) throw new Error("导出失败：没有生成文件数据。");
  const blob = new Blob([buf], { type: "video/mp4" });

  // 自检：把刚生成的文件重新读一遍，确认画面+声音两条轨道都在、时长正确
  let info: ExportInfo = { videoCodec: vcodec, audioCodec: "aac", duration: seconds, frames, w, h, fps };
  try {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack();
    const at = await input.getPrimaryAudioTrack();
    if (!vt) throw new Error("导出文件校验失败：缺少画面轨道。");
    if (!at) throw new Error("导出文件校验失败：缺少声音轨道。");
    info = {
      ...info,
      videoCodec: vt.codec ?? vcodec,
      audioCodec: at.codec ?? "aac",
      duration: await input.computeDuration(),
    };
  } catch (e) {
    if ((e as Error).message.startsWith("导出文件校验失败")) throw e;
  }
  return { blob, ext: "mp4", mime: "video/mp4", seconds, info };
}

export function pickRecorderFormat(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const list: [string, "mp4" | "webm"][] = [
    ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of list) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

export interface RecordResult {
  blob: Blob;
  ext: "mp4" | "webm";
  mime: string;
  seconds: number;
}

/**
 * 浏览器内“实时录制”：画面 canvas.captureStream + 合成器音频。
 * 注意：这是浏览器录屏式导出(WebM/MP4)，并不是 Node/ffmpeg 管线逐帧渲染的成品。
 */
export async function recordRealtime(o: {
  cfg: ProjectConfig;
  tl: Timeline;
  player: Player;
  w: number;
  h: number;
  onProgress: (p: number) => void;
  aborted: () => boolean;
}): Promise<RecordResult> {
  const fmt = pickRecorderFormat();
  if (!fmt) throw new Error("当前浏览器不支持视频录制（MediaRecorder）。请换用 Chrome / Edge 桌面版或新版安卓 Chrome。");
  const { cfg, tl, player, w, h } = o;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  renderFrame(ctx, w, h, 0, tl, cfg);
  const fps = cfg.canvas.fps;
  const vStream = canvas.captureStream(fps);
  const rec = player.createRecordStream();
  const stream = new MediaStream([...vStream.getVideoTracks(), ...rec.stream.getAudioTracks()]);
  const bits = Math.min(14e6, Math.max(2e6, w * h * fps * 0.1));
  const mr = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: bits, audioBitsPerSecond: 160000 });
  const chunks: Blob[] = [];
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((res) => (mr.onstop = () => res()));
  mr.start(250);
  await player.start(tl, 0, cfg.music.instrument, cfg.music.volume);
  await new Promise<void>((res) => {
    const loop = () => {
      const t = Math.min(player.now(), tl.duration);
      renderFrame(ctx, w, h, t, tl, cfg);
      o.onProgress(t / tl.duration);
      if (o.aborted() || t >= tl.duration) return res();
      requestAnimationFrame(loop);
    };
    loop();
  });
  await new Promise((r) => setTimeout(r, 150));
  player.stop();
  rec.release();
  if (mr.state !== "inactive") mr.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  if (o.aborted()) throw new Error("已取消");
  return { blob: new Blob(chunks, { type: fmt.mime.split(";")[0] }), ext: fmt.ext, mime: fmt.mime, seconds: tl.duration };
}
