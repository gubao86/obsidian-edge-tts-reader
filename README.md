# Obsidian Edge TTS Reader

[![Release](https://img.shields.io/github/v/release/gubao86/obsidian-edge-tts-reader)](https://github.com/gubao86/obsidian-edge-tts-reader/releases)
[![License](https://img.shields.io/github/license/gubao86/obsidian-edge-tts-reader)](LICENSE)

🇨🇳 中文 ｜ 🇬🇧 [English](#english)

---

## 中文

> 在 Obsidian 中调用 Microsoft Edge 的高质量中文 TTS 朗读当前笔记，**开箱即用、无需任何外部服务**。支持**句子级预取**、**当前句高亮**、**多音色 / 变速**。

### 工作原理

从 **v1.1.0** 起，插件**内嵌** [`msedge-tts`](https://www.npmjs.com/package/msedge-tts) 客户端，直接连接微软 Edge 的 TTS WebSocket 服务合成音频，**不再依赖本地 Python 服务**。装上插件即可使用。

> 仓库中保留了 `tts_server.py`（基于 Flask + [edge-tts](https://github.com/rany2/edge-tts) 的 Python 微服务）作为**可选自托管方案**，普通用户可以完全忽略它。

### 功能

- 🔊 一键朗读当前 md 笔记
- ⏩ **流水线预取**：首句立即播，后续 5 句并发预取，几乎无停顿
- 🟨 **当前句高亮**（编辑/实时预览模式下，黄色高亮 + 自动滚动）
- 🎤 **15 个中文音色**：普通话、东北话、陕西话、粤语、台湾话；男女皆有
- 🐢 **语速调节**：-50% ~ +100%
- ⌨️ 默认快捷键：`Ctrl+Shift+V` 朗读，`Ctrl+Shift+B` 停止

### 快速开始

#### 方式 1：BRAT 一键安装（推荐）

1. 在 Obsidian 中安装并启用 [BRAT 插件](https://github.com/TfTHacker/obsidian42-brat)
2. 命令面板执行：`BRAT: Add a beta plugin for testing`
3. 输入：`gubao86/obsidian-edge-tts-reader`
4. BRAT 自动下载到 vault 并启用

#### 方式 2：手动安装

到 [Releases 页面](https://github.com/gubao86/obsidian-edge-tts-reader/releases) 下载最新版的 3 个文件 `manifest.json` / `main.js` / `styles.css`，放到：

```text
<你的 vault>/.obsidian/plugins/edge-tts-reader/
```

然后在 Obsidian → 设置 → 第三方插件 → 关闭"安全模式" → 启用 `Edge TTS Reader`。

### 使用

- 打开任意 md 文件，按 `Ctrl+Shift+V` 开始朗读
- 在"设置 → Edge TTS Reader"里挑音色和语速，按"试听"立即生效
- `Ctrl+Shift+B` 随时停止

### 仓库结构

```text
obsidian-edge-tts-reader/
├── manifest.json            # Obsidian 插件清单
├── main.ts                  # 插件源码（入口）
├── settings.ts              # 插件设置类型与默认值
├── voices.ts                # 内嵌的音色列表
├── styles.css               # 高亮样式
├── main.js                  # 构建产物（含 msedge-tts，~650KB）
├── build.js                 # esbuild 打包脚本
├── package.json             # Node 依赖（msedge-tts 等）
├── tsconfig.json
├── tts_server.py            # 可选：本地 Python TTS 微服务
├── requirements.txt         # 可选：Python 依赖
├── start-obsidian.sh        # 可选：启动 Python 服务 + Obsidian
├── .github/workflows/       # GitHub Actions（推 tag 自动发 Release）
├── docs/INSTALL.md          # 详细安装说明（自研插件四种方式）
├── LICENSE
└── README.md
```

### 开发

```bash
npm install
npm run build      # 用 esbuild 把 main.ts 打包为 main.js
npm run typecheck  # 仅做类型检查
```

修改源码后只需 `npm run build`，再让 Obsidian "重新加载"（`Ctrl+R`，或在设置里把插件关掉再开）即生效。

### 发布新版（自动）

仓库已配置 GitHub Actions（[`.github/workflows/release.yml`](.github/workflows/release.yml)）。发布流程：

```bash
# 1. 改 manifest.json 中的 version，比如改成 1.2.0
# 2. 提交并打 tag（tag 必须与 manifest.version 一致，不带 v 前缀）
git commit -am "release: 1.2.0"
git tag 1.2.0
git push && git push --tags
```

GitHub Actions 会自动：构建 `main.js`、校验 tag 与版本一致、创建 Release、上传 `manifest.json` / `main.js` / `styles.css`。

### 安装自研 Obsidian 插件的四种方式

详见 [`docs/INSTALL.md`](docs/INSTALL.md)，速查：

| 方式 | 适用场景 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **A. 手动拷贝** | 一次性安装 | 简单透明 | 更新需重新拷贝 |
| **B. 符号链接** | 开发期 | 改完源码 → rebuild 即生效 | 跨 vault 不便 |
| **C. BRAT 插件** | 用 GitHub Release 分发 | 自动检查更新 | 需先安装 BRAT |
| **D. 全局 + per-vault 软链** | 多 vault 共享 | 维护一份源码 | 仍需在每个 vault 启用 |

> **关键提示**：Obsidian **只从** `<vault>/.obsidian/plugins/<plugin-id>/` 加载插件。`~/.obsidian/plugins/` 不会被自动加载。

### 附录：可选 Python 自托管服务

如果你不想让插件直连微软（例如在公司网络下统一出口、或需要做请求审计），可以自行启动仓库中的 Python 服务。**当前主代码已不会调用它**，如需切回 HTTP 模式可 fork 后修改 `synthesize()`。

```bash
pip install -r requirements.txt
python3 tts_server.py
# 服务监听 http://localhost:18080
```

### 已知限制

- **阅读视图**下没有编辑器选区，**不显示高亮**（音频仍正常播放）
- 句子切分基于 `。！？!?\n`，无标点的长段会作为一句整体送入 TTS
- 高亮当前是**句子级**；逐字高亮需要 `msedge-tts` 的 wordBoundary 事件，暂未实现
- 仅桌面端可用（`isDesktopOnly: true`）

### License

MIT © aluo

---

<a id="english"></a>

## English

> Read your current note aloud in Obsidian using Microsoft Edge's high-quality TTS. **Works out of the box, no external services needed.** Features sentence-level prefetching, current-sentence highlighting, multiple voices and speed control.

### How it works

Starting from **v1.1.0**, the plugin embeds the [`msedge-tts`](https://www.npmjs.com/package/msedge-tts) client and connects directly to Microsoft Edge's TTS WebSocket from inside Obsidian. **No local Python server required.** Install and you're good to go.

> `tts_server.py` (a Flask + [edge-tts](https://github.com/rany2/edge-tts) micro-service) is kept in the repo as an **optional self-hosted backend**. Regular users can ignore it.

### Features

- 🔊 One-click read of the current Markdown note
- ⏩ **Pipelined prefetch**: first sentence starts immediately, the next 5 are fetched in parallel — nearly seamless
- 🟨 **Current-sentence highlight** (in source / live-preview mode, yellow highlight + auto-scroll)
- 🎤 **15 Chinese voices**: Mandarin, Northeastern, Shaanxi, Cantonese, Taiwanese; both male and female
- 🐢 **Rate control**: -50% ~ +100%
- ⌨️ Default hotkeys: `Ctrl+Shift+V` to read, `Ctrl+Shift+B` to stop

### Quick start

#### Option 1: BRAT (recommended)

1. Install and enable the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Run command: `BRAT: Add a beta plugin for testing`
3. Enter: `gubao86/obsidian-edge-tts-reader`
4. BRAT downloads it into your vault and enables it

#### Option 2: Manual

Download `manifest.json` / `main.js` / `styles.css` from the latest [Release](https://github.com/gubao86/obsidian-edge-tts-reader/releases) and put them into:

```text
<your-vault>/.obsidian/plugins/edge-tts-reader/
```

Then in Obsidian: Settings → Community plugins → turn off Safe mode → enable `Edge TTS Reader`.

### Usage

- Open any `.md` file, press `Ctrl+Shift+V` to start
- Settings → Edge TTS Reader: pick a voice, adjust rate, preview
- `Ctrl+Shift+B` to stop anytime

### Repository layout

```text
obsidian-edge-tts-reader/
├── manifest.json            # Obsidian plugin manifest
├── main.ts                  # Plugin entry source
├── settings.ts              # Settings types & defaults
├── voices.ts                # Built-in voice catalog
├── styles.css               # Highlight styles
├── main.js                  # Bundled output (~650KB with msedge-tts)
├── build.js                 # esbuild build script
├── package.json             # Node dependencies
├── tsconfig.json
├── tts_server.py            # Optional Python micro-service
├── requirements.txt         # Optional Python deps
├── start-obsidian.sh        # Optional helper for the Python flow
├── .github/workflows/       # GitHub Actions for tag-driven releases
├── docs/INSTALL.md          # In-depth install guide for self-built plugins
├── LICENSE
└── README.md
```

### Development

```bash
npm install
npm run build      # bundle main.ts -> main.js via esbuild
npm run typecheck  # type-check only
```

After editing, run `npm run build`, then reload Obsidian (`Ctrl+R`, or toggle the plugin off/on).

### Releasing new versions (automated)

A GitHub Actions workflow ships with the repo ([`.github/workflows/release.yml`](.github/workflows/release.yml)). To cut a release:

```bash
# 1. Bump `version` in manifest.json (e.g. 1.2.0)
# 2. Commit and tag (tag MUST equal manifest.version, no "v" prefix)
git commit -am "release: 1.2.0"
git tag 1.2.0
git push && git push --tags
```

The workflow then builds `main.js`, verifies the tag matches the manifest, creates the GitHub Release and uploads `manifest.json` / `main.js` / `styles.css` automatically.

### Four ways to install a self-built Obsidian plugin

See [`docs/INSTALL.md`](docs/INSTALL.md) for details. Cheat sheet:

| Method | When to use | Pros | Cons |
| --- | --- | --- | --- |
| **A. Manual copy** | One-off install | Simple, transparent | Re-copy to update |
| **B. Symlink** | Development | Edit → rebuild → live | Per-vault setup |
| **C. BRAT** | GitHub-based distribution | Auto-updates | Requires BRAT |
| **D. Global source + per-vault symlinks** | Multi-vault sharing | Single source of truth | Still enable per vault |

> **Important**: Obsidian only loads plugins from `<vault>/.obsidian/plugins/<plugin-id>/`. `~/.obsidian/plugins/` is **not** scanned automatically.

### Appendix: optional Python self-hosted server

If you'd rather not let the plugin talk to Microsoft directly (corporate proxy, request auditing, etc.), you can run the bundled Python service. **The current main code no longer calls it**; fork and tweak `synthesize()` to switch back to HTTP mode.

```bash
pip install -r requirements.txt
python3 tts_server.py
# listens on http://localhost:18080
```

### Known limitations

- No highlight in reading view (audio still plays)
- Sentence splitting uses `。！？!?\n`; unpunctuated long passages are sent as one chunk
- Current highlight is sentence-level; word-level highlighting via msedge-tts `wordBoundary` events is not implemented yet
- Desktop only (`isDesktopOnly: true`)

### License

MIT © aluo
