import type { Instrument, Timeline } from "./types";

// 纯代码合成音色，不依赖任何音频素材
type Partial_ = [OscillatorType, number, number, number]; // 波形, 频率倍数, 振幅, 衰减秒
const VOICES: Record<Instrument, { parts: Partial_[]; lowpass?: number }> = {
  marimba: { parts: [["sine", 1, 1, 0.6], ["sine", 4, 0.3, 0.1], ["sine", 10, 0.06, 0.035]] },
  bell: {
    parts: [["sine", 1, 0.6, 2.2], ["sine", 2.76, 0.35, 1.6], ["sine", 5.4, 0.2, 1.0], ["sine", 8.93, 0.1, 0.6], ["sine", 0.5, 0.25, 2.4]],
  },
  pluck: { parts: [["triangle", 1, 0.7, 0.9], ["sawtooth", 1, 0.12, 0.35], ["sine", 2, 0.2, 0.5]], lowpass: 5 },
  piano: { parts: [["sine", 1, 0.7, 1.4], ["sine", 2, 0.35, 0.9], ["sine", 3, 0.18, 0.6], ["triangle", 4, 0.08, 0.35]] },
};

export const INSTRUMENTS: { value: Instrument; label: string }[] = [
  { value: "marimba", label: "木琴" },
  { value: "bell", label: "水晶铃" },
  { value: "pluck", label: "拨弦" },
  { value: "piano", label: "钢琴感" },
];

function scheduleNote(ctx: BaseAudioContext, dest: AudioNode, when: number, midi: number, inst: Instrument, vel: number) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const voice = VOICES[inst];
  const pitchScale = Math.min(1.6, Math.max(0.5, Math.pow(2, (60 - midi) / 24)));
  let out: AudioNode = dest;
  if (voice.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(12000, f * voice.lowpass * 2), when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), when + 0.5);
    lp.connect(dest);
    out = lp;
  }
  for (const [type, ratio, amp, decay] of voice.parts) {
    if (f * ratio > 16000) continue;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const d = decay * pitchScale;
    o.type = type;
    o.frequency.value = f * ratio;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(amp * vel * 0.32, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + d);
    o.connect(g);
    g.connect(out);
    o.start(when);
    o.stop(when + d + 0.05);
  }
}

/**
 * 离线渲染整首音频（不走声卡、不受页面卡顿影响）。
 * 与 Player 使用同一套合成与压缩器链路；音符在 AudioBuffer 中的位置 = 时间线 ev.t，
 * 因此与逐帧渲染的画面（帧 i 对应 t = i / fps）严格对齐。
 */
export async function renderAudioBuffer(tl: Timeline, inst: Instrument, volume: number, seconds: number, sampleRate = 48000): Promise<AudioBuffer> {
  const length = Math.ceil(seconds * sampleRate);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  const s = ctx.createGain();
  s.gain.value = volume;
  s.connect(comp);
  for (const ev of tl.events) {
    if (ev.t >= seconds) continue;
    scheduleNote(ctx, s, ev.t, ev.midi, inst, 0.85);
  }
  return ctx.startRendering();
}

/** 播放器：以 AudioContext 时钟为准，画面跟着声音走 */
export class Player {
  ctx: AudioContext | null = null;
  private comp!: DynamicsCompressorNode;
  private out!: GainNode;
  private session: GainNode | null = null;
  private t0 = 0;
  private from = 0;
  playing = false;
  muted = false;

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.comp = this.ctx.createDynamicsCompressor();
      this.out = this.ctx.createGain();
      this.comp.connect(this.out);
      this.out.connect(this.ctx.destination);
      this.out.gain.value = this.muted ? 0 : 1;
    }
    return this.ctx;
  }

  /** 录制用：从静音开关之前取声音 */
  createRecordStream() {
    const ctx = this.ensure();
    const dest = ctx.createMediaStreamDestination();
    this.comp.connect(dest);
    return { stream: dest.stream, release: () => this.comp.disconnect(dest) };
  }

  async start(tl: Timeline, from: number, inst: Instrument, volume: number) {
    const ctx = this.ensure();
    if (ctx.state !== "running") await ctx.resume().catch(() => {});
    this.stopSound();
    const s = ctx.createGain();
    s.gain.value = volume;
    s.connect(this.comp);
    this.session = s;
    this.t0 = ctx.currentTime + 0.06;
    this.from = from;
    for (const ev of tl.events) {
      if (ev.t < from - 0.001) continue;
      scheduleNote(ctx, s, this.t0 + (ev.t - from), ev.midi, inst, 0.85);
    }
    this.playing = true;
  }

  now() {
    if (!this.ctx) return this.from;
    return this.from + Math.max(0, this.ctx.currentTime - this.t0);
  }

  private stopSound() {
    const s = this.session;
    if (s && this.ctx) {
      s.gain.cancelScheduledValues(this.ctx.currentTime);
      s.gain.setValueAtTime(0, this.ctx.currentTime);
      setTimeout(() => s.disconnect(), 80);
    }
    this.session = null;
  }

  stop() {
    this.stopSound();
    this.playing = false;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.out) this.out.gain.value = m ? 0 : 1;
  }
}
