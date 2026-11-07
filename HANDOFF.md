# HANDOFF · video-kit 音乐可视化工作台（第 9 轮：加上分球机）

## 第 9 轮（最新，优先阅读）

**2026-11-06，用户点头：按频道数据先加第一步。导出仍算已经可用，本轮没再改导出。**

做了什么：
- 新玩法 `ball-sort`（分球机），注册在三个音乐场景**后面**，没有删泡泡琴键 / 五线谱流光 / 下落音条。
- 参数：球数、盒子数、路径（直道 / 螺旋）、门（无门 / 固定门 / 移动门）、分完停住的秒数。
- 默认就是表里赢过的那条：16 球、4 盒、直道、无门、分完停约 1 秒。螺旋和移动门是变体，不是默认。
- 模板 `presets/06-ball-sort.json`，名字「16球4盒」。竖屏。用一段**没有声音**的乐谱把成片定在约 14 秒（音量 0）。工作台里打开这个模板就能看。
- 这是编排出来的分拣，不是真实物理碰撞。同一个参数，球永远进同一只盒子。
- 成片时长仍走原来的乐谱时间线，没有另写一套时钟。
- 玩法面板以前不画「选项」类参数，分球机的路径和门会选不了。本轮在 `Panels.tsx` 补上了，说明页也会列出可选项。`config.ts` 会把不在选项里的值夹回默认。

没做：弹跳奏乐、弹簧、π 碰撞、长科普。不要顺着一次做完。

验证：改过的文件过了 `tsc --noEmit` 和 `npm run build`。用无头画布看过默认直道、螺旋、移动门的几帧（开头、中段、结尾），结尾球都在对应颜色的盒子里。没有在真实浏览器里点过这一条新模板。

## 落款约束（从 2026-11-06 起，每次改动都要遵守）

改到的每个文件都留下落款，下一位先读落款再动笔。代码写在文件头注释里；改到函数中间，就写在那一段旁边。JSON 没有注释，写进 `ext.credit`。

四行，缺一不可：
- 落款：谁 · 日期
- 改动：这一次具体改了什么
- 下一手：下一位从哪里接着，明确不要动什么
- 再改：后来的人在同一条下面追加，不要把以前的落款删掉

只在聊天里说改了什么不算。仓库里的落款才算数。本轮落款人是 Grok（xAI）。

---

## 第 8 轮更新

**问题**：Chrome 桌面版导出的 MP4 音画错乱、放不了。原因：旧导出是 MediaRecorder **实时录屏**——Chrome 产出的是分片 MP4、时间戳不稳定，画面靠 requestAnimationFrame 抓取会丢帧，音频流与视频流各自起步，容易错位且很多播放器不认。

**修复**（`src/engine/recorder.ts` 的 `exportMp4`）：改为**逐帧离线渲染**
- 画面：第 i 帧固定渲染 `t = i / fps`（`draw` 本来就是 t 的纯函数），`CanvasSource` 经 WebCodecs 编码 H.264（不支持则回退 VP9/AV1）。
- 声音：`audio.ts` 的 `renderAudioBuffer` 用 `OfflineAudioContext` 离线合成整首（与实时播放同一条合成链路），编码 AAC；浏览器无原生 AAC 编码器时用 `@mediabunny/aac-encoder`（WASM 已内嵌，单文件可用）。
- 封装：`mediabunny`，`fastStart: "in-memory"`（moov 在文件头），标准 MP4。
- 导出后自检：把生成的文件重新读一遍，确认画面+声音两条轨道都在并显示时长。
- 不支持 WebCodecs 的浏览器仍退回旧的 `recordRealtime`（实时录屏），页面会提示。
- 新增依赖：`mediabunny`、`@mediabunny/aac-encoder`（构建后 index.html 约 2 MB）。

**验证状态（不夸大）**：`tsc --noEmit` 与 `npm run build` 通过；确认 AAC 的 WASM 内嵌、不会请求外部文件。
**2026-11-06 用户实机确认：导出已经没问题。** 第 8 轮「尚未实机验证」到此结束。以后若再改 `recorder.ts`，仍要用户再导出一条确认，不要因构建通过就当成文件能播。

---

> 读这一份就够接着干。更短的“下次开场怎么说”在 NEXT_SESSION.md。

## 1. 这一轮的方向（用户明确定的，以此为准）

- 用户要的是**音乐可视化**，不是“楼梯”。参考截图有两类：
  - A：小球/泡泡在彩色琴键（木琴片）上一路弹跳，旁边有歌词字，落地有气泡粒子（暗灰底 / 蓝紫底两种配色）。
  - B：倾斜透视的五线谱，白色发光音符，黄色流星在音符间跳跃，有彩虹频谱条，暖棕色底。
- 上一轮的 staircase 方向作废；本轮**不做**旧 Node 管线、不做视频渲染，**专心做“工作台”**。
- 用户**不能运行命令**，只会在页面里点。所以：不要再把命令当成交付物；要给就给成品（页面里的按钮、可下载文件）。
- 思路：**工作台做好，之后新增视频基本只写 JSON 配置**，不再每次从零开始。前期从简单做，预留扩展位。
- 用户需要把项目上传 GitHub，供下一轮对话使用。

## 2. 已完成（本轮实际做出来的）

一个纯前端工作台（React + Vite + Tailwind，单文件输出 `dist/index.html`），**所有设置 = 一份 JSON**。

- 工作台页：实时预览（Canvas）、播放/暂停/拖动进度/循环/静音、音符轨道（可点击跳转）。
- 5 个面板：音乐 / 玩法 / 画面 / 导出 / 配置(JSON 直接编辑，实时校验并给中文提示)。
- 3 个音乐玩法，加 1 个机关玩法（都留着）：
  - `bubble-keys` 泡泡琴键（对应参考 A）
  - `glow-staff` 五线谱流光（对应参考 B）
  - `falling-bars` 下落音条（钢琴瀑布）
  - `ball-sort` 分球机（第 9 轮，见文首。编排分拣，不是真实碰撞）
- 5 个调色板、4 种合成音色（木琴/水晶铃/拨弦/钢琴感，全部 WebAudio 代码合成，无音频素材）。
- 乐谱写法：音名（`C4:1 D#4:0.5 R:1`）和**简谱**（`1 2 3 5' 6, #4 - 0`）；歌词一音一字。
- 旋律库全部为公版或原创：小星星、欢乐颂、献给爱丽丝(开头)、铃儿响丁当(副歌)、林间脚步(原创)、C 大调音阶。
- 作品库：本机自动保存(localStorage)、新建/复制/删除/导出 JSON/导入 JSON(可一次导入数组)。
- 模板库：`presets/*.json`，5 个很短的 JSON，字段缺省自动补齐。
- 配置说明页：从玩法注册表自动生成（参数、范围、默认值、调色板、音色、旋律 id）。
- 导出：浏览器内逐帧离线渲染 MP4（第 8 轮，2026-11-06 用户确认可用）、封面 PNG、配置 JSON。
- **交接页：页面里一键下载完整源码 ZIP**（源码在构建时打进页面，所以只部署单个 index.html 也能下载）。

> 关于“上次交接包没有”：很可能因为交接 ZIP 放在 `public/`，而线上只服务了 `dist/index.html`，其它文件拿不到。
> 所以本轮把 ZIP 生成做进页面本身，不再依赖任何额外文件。

## 3. 实际验证了什么 / 没验证什么（不夸大）

已验证（有输出为证）：
- `npx tsc --noEmit` 无错误；`npm run build` 成功。
- 三个玩法在无头 Canvas（@napi-rs/canvas）下渲染多个时间点、竖屏与横屏，肉眼检查画面；发现并修复了“泡泡拖尾过曝”和“拖尾半径为负导致 arc 抛异常”两个问题。
- 用 jsdom 加载打包后的页面跑 UI 流程：切换 5 个面板、切换 3 个玩法、拖滑杆、在 JSON 面板应用配置（越界 bpm 被夹回、未知调色板/参数给出提示、非法 JSON 给出提示）、作品库/说明/交接页渲染、触发源码 ZIP 下载、localStorage 写入。结果：无报错。
- **导出：2026-11-06 用户在真实电脑上确认 MP4 已经没问题。** 以此为准，不要再把「导出没验证」写回交接。

**没有验证（沙盒没有可用的真实浏览器/声卡）：**
- 真实声音是否好听、音画是否同步（用户只确认导出文件没问题，没单独说合成音色好不好听）。
- 手机上的预览与导出。
- 真实手机上的预览流畅度（无头 CPU 渲染单帧约 100~200ms，浏览器 GPU 下应快很多，但未实测）。
- 源码 ZIP 解压后能否 `npm install && npm run build`（ZIP 为自写的“仅存储”格式，jsdom 中只验证了触发下载）。
- 画面与参考截图的“像”程度只是 2D 近似（见 §6）。

## 4. 文件位置

```
index.html / package.json / vite.config.ts / tsconfig.json   工程文件（不要手改 package.json）
presets/*.json                    模板（短 JSON，加文件即加模板）
src/App.tsx                       外壳：侧栏/手机底栏、导入导出、视图切换
src/store.ts                      作品存取（localStorage，键 vk.projects.v1）
src/components/Workbench.tsx      工作台布局 + 标签页
src/components/Preview.tsx        预览画布、播放控制、音符轨道
src/components/Panels.tsx         音乐/玩法/画面/导出/配置 五个面板
src/components/Library.tsx        作品库 + 模板库（带缩略图）
src/components/Docs.tsx           配置说明（自动生成）
src/components/Handoff.tsx        交接页 + 源码 ZIP 下载
src/components/ui.tsx, Markdown.tsx   通用控件 / 极简 Markdown
src/engine/types.ts               ProjectConfig 等类型 ← 配置结构的唯一定义
src/engine/config.ts              默认值、normalizeConfig(校验补全)、parseImport、模板加载
src/engine/music.ts               旋律库、乐谱解析(音名+简谱)、时间线编译
src/engine/audio.ts               合成音色 + Player(以 AudioContext 时钟为准)
src/engine/recorder.ts            浏览器录制（逐帧离线 MP4，实机已确认）
src/engine/render.ts              renderFrame：预览/封面/导出共用的唯一渲染入口
src/engine/palettes.ts            调色板
src/engine/scenes/*.ts            玩法：bubbleKeys / glowStaff / fallingBars / ballSort + index.ts 注册表
src/engine/sources.ts, zip.ts     构建时嵌入源码 + 极简 ZIP
```

## 5. 配置结构（schema `video-kit.project/1`）

```json
{
  "schema": "video-kit.project/1",
  "name": "作品名",
  "canvas": { "aspect": "9:16 | 16:9 | 1:1", "fps": 30 },
  "music": { "preset": "twinkle", "notes": "(缺省则取旋律库)", "bpm": 112, "keyRoot": "C",
             "transpose": 0, "instrument": "marimba|bell|pluck|piano", "volume": 0.8, "repeat": 1, "tail": 2 },
  "lyrics": "一音一字",
  "text": { "title": "", "subtitle": "", "show": true },
  "scene": { "type": "bubble-keys|glow-staff|falling-bars", "palette": "dusk|ink|amber|forest|sakura", "params": {} },
  "ext": {}
}
```
- 任何入口(导入、JSON 面板、将来的 Node 渲染)都必须走 `normalizeConfig`。
- `ext` 是预留口：新能力先放这里，旧配置不会坏。

## 6. 已知限制

- 画面是 2D 画布“伪透视”，不是 Blender 那种真 3D 光影；参考 A 里琴键片的 3D 翻转、景深、镜头旋转没有。
- 频谱是“按音符合成的示意”，不是真实音频分析。
- 歌词只支持“一音一字/一词”，没有竖排金色大字样式（参考 A 的左侧竖排歌词）。
- 单声部：一次只有一个音（无和弦/多声部）。
- 分球机一定会分对，看起来像机关，但球没有互相碰撞。
- 分球机模板默认没有声音。要响，把音量调上去，但那段乐谱只有结尾一个音，不是配乐。
- 作品存在浏览器 localStorage，清缓存/换设备会丢，请导出 JSON 备份。
- 上一轮的 Node 管线、5 个旧场景、历史 mp4：**本轮沙盒里不存在，也没有读取 GitHub 仓库**。GitHub 上若已有 video-kit 内容，请**不要覆盖**，见 §8。
- 任何 API key 都不得写入仓库；旧的 AIza 开头 key 仍应在 Google Cloud 撤销。

## 7. 下一轮最小行动

1. 导出不再当第一优先。用户已确认可用。分球机没改导出。
2. 请用户在工作台打开模板「16球4盒」：先看直道默认，再切螺旋、移动门。不好看就说哪一帧，不要推倒重写。
3. 用户点头之前，不要加弹跳奏乐、弹簧、π。不要删三个音乐场景。
4. 之后要新视频：仍是优先写 JSON；需要新玩法才写代码（见 §9）。

## 8. 怎么上传 GitHub（用户不用命令）

- 在页面「交接」页点“下载完整源码 ZIP”，解压得到 `video-kit-workbench` 文件夹。
- 推荐传到仓库 `JacketYang/video-kit` 的**新子目录** `workbench/`（避免覆盖旧成果）；或建一个新仓库。
- GitHub 网页：Add file → Upload files → 拖入文件夹全部内容 → Commit。
- 最少需要：`HANDOFF.md、NEXT_SESSION.md、presets/、src/、package.json、index.html、vite.config.ts、tsconfig.json、.gitignore`。不需要 node_modules、dist。
- 下一轮对话：把仓库地址 + 本文件内容发来，或直接上传 ZIP。

## 9. 给“强模型”的扩展契约

- 新增玩法：新建 `src/engine/scenes/xxx.ts` 导出 `SceneDef`（含 `params` 定义与 `draw`），在 `scenes/index.ts` **末尾**加一行。数字、开关、选项都会出现在参数面板和说明页。选项类参数是第 9 轮补上的，不要再假定面板只有滑杆。
- **落款约束见文首。** 改到的文件必须留下落款，禁止只在聊天里交代。
- `draw` 必须是 `t` 的**纯函数**：不累积状态、不用 `Math.random/Date.now`（用 `util.rng(seed)`），这样拖动进度/重播/导出画面一致。
- 新增旋律：`music.ts` 的 `MELODIES`，只收公版或原创。新增调色板：`palettes.ts`。新增音色：`audio.ts` 的 `VOICES`。
- 新增配置字段：先放 `ext`，稳定后再升到正式字段并更新 `types.ts` / `normalizeConfig`。
- 想要真正的“成品视频”：另起 Node 渲染管线，复用 `engine/` 里的 `normalizeConfig + compileTimeline + renderFrame`（它们不依赖 DOM，已用 @napi-rs/canvas 验证可渲染），再用 ffmpeg 合成声音。注意 `config.ts` 里的 `import.meta.glob` 只在 Vite 下有效，Node 里需拆出去。
- 后续创意候选（不要一次全做）：参考 A 的竖排歌词 + 暗色 3D 琴键、摆波、傅里叶画图、最速降线。

## 10. 方向（数据结论仍有效；第一步已在第 9 轮做完）

依据频道表格（约 2026-10-26 至 11-05 的 Shorts，旧片观看为 0 不计）：现在有播放的不是琴键/五线谱，是 **13–16 秒的物理机关短片**。合计观看约 1.2 万，深度观看 4979，平均看完 112%，继续看 42%，订阅只 +5。封面展示很少，不要为点击率改产品。

同一套「16 球 4 盒」占了前排。强弱已经分开：
- 很快分完、有明确结局（10–12 秒）：继续看最高（约 62%）。
- 螺旋、移动门：单条循环极高（看完 190–210%），但继续看掉到约 33%。
- 4 个门：同系列最弱，看完约 83%。
- 球弹《欢乐颂》能进前十，但不如纯分球。30 秒以上的科普看完率明显掉下去。

**建议的第一步已经做了**（分球机，见文首）。还没做的是弹跳奏乐。弹簧、π 碰撞、长科普继续先不做。螺旋和移动门只是分球机里的参数，不是下一条必须做的片子。
