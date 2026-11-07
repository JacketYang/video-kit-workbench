import { SCENES } from "../engine/scenes";
import { PALETTES } from "../engine/palettes";
import { MELODIES } from "../engine/music";
import { INSTRUMENTS } from "../engine/audio";
import { makeConfig, stringifyConfig } from "../engine/config";

const th = "border border-white/10 bg-white/5 px-2 py-1.5 text-left text-[11px] font-medium text-slate-300";
const td = "border border-white/10 px-2 py-1.5 text-[11px] text-slate-400 align-top";
const code = "rounded bg-white/10 px-1 font-mono text-amber-200";

export function Docs() {
  const sample = stringifyConfig(makeConfig());
  return (
    <div className="mx-auto w-full max-w-[920px] space-y-8 p-3 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">配置说明</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          工作台 = 一份 JSON 的可视化编辑器。本页内容全部从代码里的“玩法注册表”自动生成，永远和程序一致。
          以后加新玩法，只需新增一个场景文件并注册，这里和工作台的参数面板会自动出现，不用改界面。
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-amber-200">最小配置示例（缺省字段自动补齐）</h2>
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
{`{
  "schema": "video-kit.project/1",
  "name": "我的第一支",
  "music": { "preset": "twinkle", "instrument": "bell" },
  "scene": { "type": "glow-staff", "palette": "amber", "params": { "speed": 1.2 } }
}`}
        </pre>
        <details className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
          <summary className="cursor-pointer text-slate-300">查看完整配置（一份默认作品的全部字段）</summary>
          <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-300">{sample}</pre>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-amber-200">玩法（scene.type）</h2>
        {SCENES.map((s) => (
          <div key={s.id} className="rounded-xl border border-white/10 bg-[#12151d] p-3">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-slate-100">{s.name}</span>
              <span className={code}>{s.id}</span>
            </div>
            <p className="mb-2 mt-1 text-xs text-slate-400">{s.desc}</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={th}>参数 (scene.params.*)</th>
                    <th className={th}>含义</th>
                    <th className={th}>类型</th>
                    <th className={th}>范围</th>
                    <th className={th}>默认</th>
                  </tr>
                </thead>
                <tbody>
                  {s.params.map((p) => (
                    <tr key={p.key}>
                      <td className={td}><span className={code}>{p.key}</span></td>
                      <td className={td}>{p.label}</td>
                      <td className={td}>{p.type === "number" ? "数字" : p.type === "boolean" ? "开关" : "选项"}</td>
                      <td className={td}>
                        {/* 落款：Grok（xAI）· 2026-11-06。改动：选项参数把可选项写进说明。下一手：不用再改这格。 */}
                        {p.type === "number" ? `${p.min} ~ ${p.max}` : p.type === "select" ? (p.options ?? []).map((o) => o.label).join(" / ") : "—"}
                      </td>
                      <td className={td}>{String(p.default)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#12151d] p-3">
          <h2 className="mb-2 text-sm font-semibold text-amber-200">调色板 scene.palette</h2>
          {PALETTES.map((p) => (
            <div key={p.id} className="flex justify-between py-0.5 text-xs text-slate-400">
              <span className={code}>{p.id}</span>
              <span>{p.name}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/10 bg-[#12151d] p-3">
          <h2 className="mb-2 text-sm font-semibold text-amber-200">音色 music.instrument</h2>
          {INSTRUMENTS.map((p) => (
            <div key={p.value} className="flex justify-between py-0.5 text-xs text-slate-400">
              <span className={code}>{p.value}</span>
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#12151d] p-3">
        <h2 className="mb-2 text-sm font-semibold text-amber-200">旋律库 music.preset（填了就自动带出乐谱、速度、歌词）</h2>
        {MELODIES.map((m) => (
          <div key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1 text-xs text-slate-400">
            <span>
              <span className={code}>{m.id}</span> <span className="ml-1 text-slate-200">{m.name}</span>
            </span>
            <span className="text-slate-500">{m.bpm} BPM · {m.credit}</span>
          </div>
        ))}
        <p className="mt-2 text-[11px] text-slate-500">版权规则：只用公版旋律或本项目原创；不要放现代流行歌曲旋律。</p>
      </section>

      <section className="space-y-2 rounded-xl border border-white/10 bg-[#12151d] p-3 text-xs leading-relaxed text-slate-400">
        <h2 className="text-sm font-semibold text-amber-200">乐谱写法 music.notes</h2>
        <p>
          音名 <span className={code}>C4 D#4 Bb3</span>；时值用冒号 <span className={code}>E4:2</span>（拍）；休止 <span className={code}>R:1</span>；
          简谱 <span className={code}>1 2 3 5' 6, #4</span>（<span className={code}>music.keyRoot</span> 决定 1 是哪个音）；延音 <span className={code}>-</span>；小节线 <span className={code}>|</span> 忽略。
        </p>
        <p>歌词 <span className={code}>lyrics</span>：中文一音一字，英文以空格分词；标点自动跳过。</p>
        <p>预留字段 <span className={code}>ext</span>：以后新增能力（多声部、背景图、字幕样式……）先放这里，旧配置不会坏。</p>
      </section>
    </div>
  );
}
