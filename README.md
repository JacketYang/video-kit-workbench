# video-kit 音乐可视化工作台

浏览器里的音乐可视化小工作台：选旋律、选玩法、调参数，实时预览带声音，可录制导出视频。
所有设置就是一份 JSON（schema `video-kit.project/1`），可导入/导出。

- 玩法：泡泡琴键 / 五线谱流光 / 下落音条 / 分球机（`src/engine/scenes/`，可扩展）
- 模板：`presets/*.json`
- 说明与交接：见 `HANDOFF.md`、`NEXT_SESSION.md`，或工作台里的「配置说明」「交接」页

开发（仅在有 Node 的机器上需要）：`npm install` → `npm run dev` / `npm run build`

## 一键部署

`npm run build` 的产物是**单个自包含的 `dist/index.html`**（约 2.1MB，CSS/JS/WASM 全在里面，没有其它资源文件），所以**任何静态托管都能直接放**——把 `dist/` 传上去就行，不需要服务端、不需要 Node 运行时。下面的脚本只是把「构建 → 校验 → 上传」串成一条命令。

```bash
./deploy.sh --target pack     # 先试：只构建 + 打出可上传的 zip，不碰任何平台
./deploy.sh --dry-run         # 只构建 + 打印将要执行的命令，不需要凭据
```

| 平台 | 需要设置的环境变量 | 命令 |
| --- | --- | --- |
| Vercel | `VERCEL_TOKEN`（可选 `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID`，用于发到指定项目/团队） | `./deploy.sh --target vercel` |
| Netlify | `NETLIFY_AUTH_TOKEN`、`NETLIFY_SITE_ID` | `./deploy.sh --target netlify` |
| Cloudflare Pages | `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`（可选 `CLOUDFLARE_PAGES_PROJECT`，默认 `video-kit-workbench`） | `./deploy.sh --target cloudflare` |
| GitHub Pages | 无（push 到 `main` 由 `.github/workflows/deploy.yml` 自动构建发布） | `./deploy.sh --target github` |
| 本地打包 / 任意静态托管 | 无 | `./deploy.sh --target pack`，然后上传 `dist/` |

- 凭据只从环境变量读，脚本不写进任何文件、不回显 token；缺哪个变量会直接告诉你去哪个页面拿、叫什么名字，然后退出（不会假装成功）。
- 平台配置文件已就位：`vercel.json`、`netlify.toml`、`wrangler.toml`、`.github/workflows/deploy.yml`（Git 连接部署时平台自己读这些；用脚本手动部署时脚本负责上传，不依赖它们）。
- 部署到自己的静态托管（Nginx / S3 / OSS / GitHub Pages 手动上传……）时，把 `dist/index.html` 传成站点的 `index.html` 即可。

落款：Grok（xAI）· 2026-11-06。改动：玩法列表加上分球机。下一手：细节以 HANDOFF.md 第 9 轮和「落款约束」为准，不要删泡泡琴键、五线谱流光、下落音条。再改本文件请在这段下面追加，不要删这三行。

