#!/usr/bin/env bash
#
# video-kit 一键部署脚本
#
# 本项目构建产物是**单个自包含的静态文件** dist/index.html（约 2MB，无其它资源），
# 所以任何静态托管都能放。这个脚本负责：装依赖（如需）→ 构建 → 校验 → 上传。
#
# 用法：
#   ./deploy.sh                          # 默认部署到 vercel
#   ./deploy.sh --target vercel          # vercel | netlify | cloudflare | github | pack
#   ./deploy.sh --target netlify
#   ./deploy.sh --dry-run                # 只构建 + 打印将要执行的命令，不上传
#   ./deploy.sh --target pack            # 不打任何平台，只产出 dist/ + zip 包
#   ./deploy.sh --help
#
# 凭据一律从环境变量读取，脚本不会把 token 写进任何文件，也不会回显 token 的值。
#
set -euo pipefail

# 从任意 cwd 运行都能定位到仓库根目录
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TARGET="vercel"
DRY_RUN=0
MIN_INDEX_BYTES=1048576   # 1 MiB：低于这个数说明构建不完整（正常约 2.1MB）
VALID_TARGETS="vercel netlify cloudflare github pack"

# ---------- 小工具 ----------------------------------------------------------

die() { printf '\n✗ 失败：%s\n' "$*" >&2; exit 1; }

step() { printf '\n[%s] %s\n' "$1" "$2"; }

note() { printf '    %s\n' "$*"; }

usage() {
  cat <<'EOF'
video-kit 一键部署

用法：
  ./deploy.sh [--target <平台>] [--dry-run]

选项：
  --target vercel       部署到 Vercel（默认）。需要 VERCEL_TOKEN
  --target netlify      部署到 Netlify。需要 NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID
  --target cloudflare   部署到 Cloudflare Pages。需要 CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
  --target github       只做检查并提示（推送到 main 后由 GitHub Actions 自动部署）
  --target pack         不部署，只产出 dist/ 与 video-kit-workbench-<日期>.zip
  --dry-run, -n         只构建 + 打印将要执行的命令，不上传，不需要任何凭据
  --help, -h            显示这段帮助

示例：
  ./deploy.sh --target pack
  VERCEL_TOKEN=xxx ./deploy.sh --target vercel
EOF
}

# 打印并**总是执行**：构建/安装类命令。dry-run 也要真跑，
# 否则「能不能构建成功」这件事就没被验证。
run() {
  printf '    $ %s\n' "$*"
  "$@"
}

# 打印，但只有非 dry-run 才执行：上传与上传前的准备动作。
# 只用于 argv 里没有密钥的命令。
plan() {
  printf '    $ %s\n' "$*"
  if [ "$DRY_RUN" = 0 ]; then "$@"; fi
}

# 同上，但命令含密钥：$1 是给人看的（已脱敏）命令串，其余是真实 argv。
# 调用点的密钥变量必须写成 "${X:-}"，否则 dry-run 下 set -u 会因未定义而退出。
plan_secret() {
  local display="$1"; shift
  printf '    $ %s\n' "$display"
  if [ "$DRY_RUN" = 0 ]; then "$@"; fi
}

# 写本地文件；dry-run 时只打印。
write_local() { # $1=路径 $2=内容
  printf '    $ write %s\n' "$1"
  if [ "$DRY_RUN" = 0 ]; then printf '%s' "$2" >"$1"; fi
}

# 检查必需的环境变量；缺失时打印「去哪拿 / 怎么设」并 exit 1。
# dry-run 下缺失只提示，不退出。
require_env() { # $1=变量名 $2=获取地址 $3=怎么拿 $4=可选/必需说明
  local name="$1" url="$2" how="$3" extra="${4:-}"
  if [ -n "${!name:-}" ]; then
    note "✓ $name 已设置（值不回显）"
    return 0
  fi
  if [ "$DRY_RUN" = 1 ]; then
    note "· $name 未设置（--dry-run 不需要凭据；真部署时必须设置）"
    return 0
  fi
  {
    printf '\n✗ 缺少凭据：%s\n' "$name"
    printf '  去哪拿：%s\n' "$url"
    printf '  怎么拿：%s\n' "$how"
    [ -n "$extra" ] && printf '  说明　：%s\n' "$extra"
    printf '  怎么设：export %s="粘贴你的值"\n' "$name"
    printf '  然后重跑：./deploy.sh --target %s\n' "$TARGET"
  } >&2
  exit 1
}

# ---------- 参数解析 --------------------------------------------------------

while [ $# -gt 0 ]; do
  case "$1" in
    --target)
      [ $# -ge 2 ] || die "--target 需要一个值，可选：$VALID_TARGETS"
      TARGET="$2"
      shift 2
      ;;
    --target=*)
      TARGET="${1#*=}"
      shift
      ;;
    --dry-run|-n)
      DRY_RUN=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "未知参数：$1（用 ./deploy.sh --help 看用法）"
      ;;
  esac
done

case " $VALID_TARGETS " in
  *" $TARGET "*) ;;
  *) die "未知平台：$TARGET（可选：$VALID_TARGETS）" ;;
esac

printf 'video-kit 一键部署\n'
printf '  仓库目录：%s\n' "$SCRIPT_DIR"
printf '  目标平台：%s%s\n' "$TARGET" "$([ "$DRY_RUN" = 1 ] && echo '（dry-run：只构建 + 打印命令，不上传）')"

# ---------- [1/4] 环境检查 --------------------------------------------------

step "1/4" "检查环境"

command -v node >/dev/null 2>&1 || die "找不到 node。请先安装 Node.js 22+（https://nodejs.org/）"
command -v npm  >/dev/null 2>&1 || die "找不到 npm（应随 Node.js 一起安装）"
note "node $(node -v) / npm $(npm -v)"

HAS_NODE_MODULES=0
if [ -d node_modules ]; then
  HAS_NODE_MODULES=1
  note "node_modules 已存在，跳过安装"
else
  note "node_modules 不存在，构建前先 npm install"
fi

# ---------- [2/4] 构建 ------------------------------------------------------

step "2/4" "构建（vite-plugin-singlefile → 单文件 dist/index.html）"

if [ "$HAS_NODE_MODULES" = 0 ]; then
  run npm install
fi
run npm run build

# ---------- [3/4] 校验产物 --------------------------------------------------

step "3/4" "校验构建产物"

INDEX="dist/index.html"
[ -f "$INDEX" ] || die "构建后没有 $INDEX。构建输出可能被改了，检查 vite.config.ts 与 package.json 的 build 脚本。"

INDEX_BYTES="$(wc -c <"$INDEX" | tr -d ' ')"
INDEX_HUMAN="$(awk -v b="$INDEX_BYTES" 'BEGIN{printf "%.1f MB", b/1048576}')"

if [ "$INDEX_BYTES" -lt "$MIN_INDEX_BYTES" ]; then
  die "$INDEX 只有 ${INDEX_BYTES} 字节（${INDEX_HUMAN}），小于 1MB。正常产物约 2.1MB，说明构建不完整或 singlefile 插件没生效。"
fi
note "✓ $INDEX 存在，${INDEX_BYTES} 字节（${INDEX_HUMAN}）"

OTHER_FILES="$(find dist -type f ! -path 'dist/index.html' | wc -l | tr -d ' ')"
if [ "$OTHER_FILES" != "0" ]; then
  note "· 注意：dist/ 里除 index.html 外还有 ${OTHER_FILES} 个文件（本项目预期只有单文件，可能是缓存产物）"
else
  note "✓ dist/ 只有 index.html 一个文件（自包含，可直接丢到任何静态托管）"
fi

# ---------- [4/4] 按平台部署 ------------------------------------------------

step "4/4" "部署到 ${TARGET}"

case "$TARGET" in
  vercel)
    require_env VERCEL_TOKEN \
      "https://vercel.com/account/tokens" \
      "点 Create Token → 填名字、选 scope（你的账号或团队）→ 复制那串一次性显示的 token"
    # 可选：团队/项目定位。都设了才用，否则让 CLI 用 --yes 自动创建/复用同名项目。
    if [ -n "${VERCEL_ORG_ID:-}" ] && [ -n "${VERCEL_PROJECT_ID:-}" ]; then
      note "✓ VERCEL_ORG_ID / VERCEL_PROJECT_ID 已设置，将部署到指定项目"
    else
      note "· VERCEL_ORG_ID / VERCEL_PROJECT_ID 未设置：由 vercel CLI 用 --yes 自动创建/复用项目"
      note "  想指定已有项目时，两个都设上（vercel.com → 项目 → Settings → General 底部可看到 Project ID / Team ID）"
    fi

    note "准备 Vercel Build Output API 结构（--prebuilt 用，避免平台端重新装依赖构建）"
    plan rm -rf .vercel/output
    plan mkdir -p .vercel/output/static
    plan cp "$INDEX" .vercel/output/static/index.html
    write_local .vercel/output/config.json '{ "version": 3 }
'
    if [ -n "${VERCEL_ORG_ID:-}" ] && [ -n "${VERCEL_PROJECT_ID:-}" ]; then
      plan mkdir -p .vercel
      write_local .vercel/project.json "$(printf '{\n  "orgId": "%s",\n  "projectId": "%s"\n}\n' "$VERCEL_ORG_ID" "$VERCEL_PROJECT_ID")"
    fi

    note "上传（token 通过 --token 传入，不会回显；CLI 的真实报错会原样打印）"
    plan_secret "npx --yes vercel@latest deploy --prebuilt --prod --yes --token \"\$VERCEL_TOKEN\"" \
      npx --yes vercel@latest deploy --prebuilt --prod --yes --token "${VERCEL_TOKEN:-}"
    if [ "$DRY_RUN" = 1 ]; then
      note "（dry-run：以上未真正执行）"
    else
      printf '\n✓ Vercel 部署完成。上面最后一行 https://...vercel.app 就是线上地址。\n'
    fi
    ;;

  netlify)
    require_env NETLIFY_AUTH_TOKEN \
      "https://app.netlify.com/user/applications#personal-access-tokens" \
      "点 New access token → 填名字 → 复制生成的 token"
    require_env NETLIFY_SITE_ID \
      "https://app.netlify.com → 选中你的站点 → Site configuration → General → Site ID" \
      "复制 Site ID（一串 UUID）。站点要先在 Netlify 里创建好，CLI 用 --prod 直接发到它上面"
    # netlify-cli 直接读 NETLIFY_AUTH_TOKEN 环境变量，token 不进 argv、不回显。
    plan_secret "npx --yes netlify-cli@latest deploy --dir=dist --prod --site \"\$NETLIFY_SITE_ID\"" \
      npx --yes netlify-cli@latest deploy --dir=dist --prod --site "${NETLIFY_SITE_ID:-}"
    if [ "$DRY_RUN" = 1 ]; then
      note "（dry-run：以上未真正执行）"
    else
      printf '\n✓ Netlify 部署完成。上面输出的 Website URL 就是线上地址。\n'
    fi
    ;;

  cloudflare)
    require_env CLOUDFLARE_API_TOKEN \
      "https://dash.cloudflare.com/profile/api-tokens" \
      "点 Create Token → 用 Edit Cloudflare Workers 模板（或自定义：Account → Cloudflare Pages → Edit）→ 复制 token"
    require_env CLOUDFLARE_ACCOUNT_ID \
      "https://dash.cloudflare.com → 右侧栏 Account ID（或 Workers & Pages 页面右侧）" \
      "复制 32 位十六进制 Account ID"

    CF_PROJECT="${CLOUDFLARE_PAGES_PROJECT:-video-kit-workbench}"
    note "Pages 项目名：${CF_PROJECT}（首次部署时 wrangler 会问是否创建，选 Y；也可先改 wrangler.toml 的 name）"
    # wrangler 直接读 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 环境变量。
    plan_secret "npx --yes wrangler@latest pages deploy dist --project-name=\"$CF_PROJECT\"" \
      npx --yes wrangler@latest pages deploy dist --project-name="$CF_PROJECT"
    if [ "$DRY_RUN" = 1 ]; then
      note "（dry-run：以上未真正执行）"
    else
      printf '\n✓ Cloudflare Pages 部署完成。上面输出的 https://%s.pages.dev 就是线上地址。\n' "$CF_PROJECT"
    fi
    ;;

  github)
    WORKFLOW=".github/workflows/deploy.yml"
    if [ ! -f "$WORKFLOW" ]; then
      die "找不到 $WORKFLOW。这个文件负责 push 到 main 时自动构建并发布到 GitHub Pages，请先把它加回仓库。"
    fi
    note "✓ $WORKFLOW 存在"
    printf '\n这个平台不需要本脚本上传，也没有任何 token 要配：\n'
    printf '  1. 把仓库推到 GitHub 的 main 分支：\n'
    printf '       git add -A && git commit -m "deploy: 增加一键部署"\n'
    printf '       git push origin main\n'
    printf '  2. 仓库 Settings → Pages → Build and deployment → Source 选 "GitHub Actions"\n'
    printf '  3. 之后每次 push 到 main，Actions 会自动 npm ci → npm run build → 发布 dist\n'
    printf '  4. 在仓库 Actions 标签页看运行结果，Pages 地址是 https://<用户名>.github.io/<仓库名>/\n'
    ;;

  pack)
    ZIP_NAME="video-kit-workbench-$(date +%Y%m%d).zip"
    note "不部署，只打包可上传的产物"
    plan rm -f "$ZIP_NAME"
    plan zip -r -q -X "$ZIP_NAME" dist
    if [ "$DRY_RUN" = 1 ]; then
      note "（dry-run：以上未真正执行，不会生成 zip）"
    else
      [ -f "$ZIP_NAME" ] || die "zip 打包失败：$ZIP_NAME 没有生成"
      ZIP_BYTES="$(wc -c <"$ZIP_NAME" | tr -d ' ')"
      note "✓ 打包完成"
      note "  目录：$SCRIPT_DIR/dist/（直接拖到任何静态托管即可）"
      note "  压缩包：$SCRIPT_DIR/$ZIP_NAME（${ZIP_BYTES} 字节，内含 dist/index.html）"
    fi
    ;;
esac

printf '\n完成。\n'
