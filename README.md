# Obsidian Edge TTS Reader

> 在 Obsidian 中调用 Microsoft Edge 的高质量中文 TTS 朗读当前笔记，**开箱即用、无需任何外部服务**。支持**句子级预取**、**当前句高亮**、**多音色 / 变速**。

## 工作原理

从 **v1.1.0** 起，插件**内嵌** [`msedge-tts`](https://www.npmjs.com/package/msedge-tts) 客户端，直接连接微软 Edge 的 TTS WebSocket 服务合成音频，**不再依赖本地 Python 服务**。装上插件即可使用。

> 仓库中保留了 `tts_server.py`（基于 Flask + [edge-tts](https://github.com/rany2/edge-tts) 的 Python 微服务）作为**可选自托管方案**，普通用户可以完全忽略它。

---

## 功能

- 🔊 一键朗读当前 md 笔记
- ⏩ **流水线预取**：首句立即播，后续 5 句并发预取，几乎无停顿
- 🟨 **当前句高亮**（编辑/实时预览模式下，黄色高亮 + 自动滚动）
- 🎤 **15 个中文音色**：普通话、东北话、陕西话、粤语、台湾话；男女皆有
- 🐢 **语速调节**：-50% ~ +100%
- ⌨️ 默认快捷键：`Ctrl+Shift+V` 朗读，`Ctrl+Shift+B` 停止

---

## 仓库结构

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
├── docs/
│   └── INSTALL.md           # 详细安装说明（自研插件四种方式）
├── LICENSE
└── README.md
```

---

## 快速开始（普通用户）

### 方式 1：BRAT 一键安装（推荐）

1. 在 Obsidian 中安装并启用 [BRAT 插件](https://github.com/TfTHacker/obsidian42-brat)
2. 命令面板执行：`BRAT: Add a beta plugin for testing`
3. 输入：`gubao86/obsidian-edge-tts-reader`
4. BRAT 自动下载到 vault 并启用

### 方式 2：手动安装

到 [Releases 页面](https://github.com/gubao86/obsidian-edge-tts-reader/releases) 下载最新版的 3 个文件 `manifest.json` / `main.js` / `styles.css`，放到：

```text
<你的 vault>/.obsidian/plugins/edge-tts-reader/
```

然后在 Obsidian → 设置 → 第三方插件 → 关闭"安全模式" → 启用 `Edge TTS Reader`。

### 使用

- 打开任意 md 文件，按 `Ctrl+Shift+V` 开始朗读
- 在"设置 → Edge TTS Reader"里挑音色和语速，按"试听"立即生效
- `Ctrl+Shift+B` 随时停止

---

## 安装自研 Obsidian 插件的四种方式

> 详见 [`docs/INSTALL.md`](docs/INSTALL.md)，下面是速查。

| 方式 | 适用场景 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **A. 手动拷贝**（推荐） | 一次性安装 | 简单透明 | 更新需重新拷贝 |
| **B. 符号链接** | 开发期 | 改完源码 → rebuild 即生效 | 跨 vault 不便 |
| **C. BRAT 插件** | 你愿意把代码托管到 GitHub Release | 自动检查更新 | 需先安装 BRAT |
| **D. 全局 + per-vault 软链** | 多 vault 共享 | 维护一份源码 | 仍是 vault 本地启用 |

> **注意**：Obsidian **不会**自动加载 `~/.obsidian/plugins/`（这只是用户级配置目录，不是插件搜索路径）。**Obsidian 只从 `<vault>/.obsidian/plugins/<plugin-id>/` 加载插件**。

---

## 开发

```bash
npm install
npm run build      # 用 esbuild 把 main.ts 打包为 main.js
npm run typecheck  # 仅做类型检查
```

`build.js` 用 esbuild 把 `main.ts`（+ `settings.ts`）打包成单文件 `main.js`，`obsidian` 为外部依赖。

修改源码后只需 `npm run build`，再让 Obsidian "重新加载"（命令 `Reload app without saving`，或在设置里把插件关掉再开）即生效。

---

## 附录：可选 Python 自托管服务

如果你不想让插件直连微软（例如在公司网络下统一出口、或需要做请求审计），可以自行启动仓库中的 Python 服务，**不过当前主代码已经不会去调用它**。如需切回 HTTP 模式，可以 fork 修改 `synthesize()` 函数。

```bash
pip install -r requirements.txt
python3 tts_server.py
# 服务监听 http://localhost:18080
```

服务 API：

- `GET /voices` → 所有可用音色 JSON
- `POST /tts` body `{"text": "...", "voice": "zh-CN-XiaoxiaoNeural", "rate": "+0%"}` → `audio/mpeg`

```bash
curl -X POST http://localhost:18080/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"你好世界","voice":"zh-CN-XiaoxiaoNeural","rate":"+0%"}' \
  --output hello.mp3
```

---

## 已知限制

- **阅读视图**下没有编辑器选区，**不显示高亮**（音频仍正常播放）。
- 句子切分基于 `。！？!?\n`，对于不带标点的长段会被作为一句整体送给 TTS。
- 当前高亮是**句子级**；逐字高亮需要换用 `edge-tts` 的 WordBoundary 流式 API，本仓库暂未实现。
- 仅在桌面端可用（`isDesktopOnly: true`），因为依赖本地 HTTP 服务。

---

## License

MIT © aluo
