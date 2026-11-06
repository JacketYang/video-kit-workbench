import { makeZip } from "./zip";

/**
 * 交接包：构建时把源码文本直接打进页面，所以即使只部署了单个 index.html，
 * 用户也能在「交接」页一键下载完整源码 ZIP，再上传 GitHub。
 */
const mods = import.meta.glob(
  [
    "/src/**/*.{ts,tsx,css}",
    "/presets/*.json",
    "/index.html",
    "/package.json",
    "/vite.config.ts",
    "/tsconfig.json",
    "/HANDOFF.md",
    "/NEXT_SESSION.md",
    "/README.md",
    "/.gitignore",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

export const SOURCE_FILES = Object.entries(mods)
  .map(([k, v]) => ({ path: k.replace(/^\//, ""), data: v }))
  .sort((a, b) => a.path.localeCompare(b.path));

export const DOC_HANDOFF = mods["/HANDOFF.md"] ?? "（HANDOFF.md 未找到）";
export const DOC_NEXT = mods["/NEXT_SESSION.md"] ?? "（NEXT_SESSION.md 未找到）";

export const buildSourceZip = () => makeZip(SOURCE_FILES.map((f) => ({ path: `video-kit-workbench/${f.path}`, data: f.data })));
