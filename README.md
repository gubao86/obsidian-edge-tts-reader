# Obsidian Edge TTS Reader

> 在 Obsidian 中调用 Microsoft Edge 的高质量中文 TTS 朗读当前笔记，支持**句子级预取**、**当前句高亮**、**多音色 / 变速**。

本项目同时包含两部分：

1. **Obsidian 插件**（TypeScript，运行于 Obsidian 内）
2. **本地 TTS 微服务**（Python Flask + [`edge-tts`](https://github.com/rany2/edge-tts)，运行于本机 `http://localhost:18080`）

插件通过 HTTP 请求本地服务生成 MP3，再在 Obsidian 端播放。

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
├── styles.css               # 高亮样式
├── main.js                  # 构建产物（提交以便直接安装）
├── build.js                 # esbuild 打包脚本
├── package.json             # Node 依赖
├── tsconfig.json
├── tts_server.py            # 本地 TTS 微服务
├── requirements.txt         # Python 依赖
├── start-obsidian.sh        # 一键启动服务 + Obsidian
├── docs/
│   └── INSTALL.md           # 详细安装说明（自研插件四种方式）
├── LICENSE
└── README.md
```

---

## 快速开始

### 1. 启动本地 TTS 服务

```bash
# 安装 Python 依赖
pip install -r requirements.txt

# 运行服务（监听 18080）
python3 tts_server.py
```

打开 <http://localhost:18080> 看到音色列表即成功。

### 2. 安装插件到你的 vault

```bash
# 假设你的 vault 在 ~/Documents/MyVault
VAULT=~/Documents/MyVault
mkdir -p "$VAULT/.obsidian/plugins/edge-tts-reader"
cp manifest.json main.js styles.css "$VAULT/.obsidian/plugins/edge-tts-reader/"
```

在 Obsidian 中 → 设置 → 第三方插件 → 关闭"安全模式" → 启用 `Edge TTS Reader`。

### 3. 使用

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

### TTS 服务自启（systemd user service，可选）

```ini
# ~/.config/systemd/user/edge-tts.service
[Unit]
Description=Edge TTS local server

[Service]
ExecStart=/usr/bin/python3 %h/.obsidian/plugins/edge-tts-reader/tts_server.py
Restart=on-failure

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now edge-tts.service
```

---

## API（本地 TTS 服务）

- `GET /voices` → 返回所有可用音色 JSON
- `POST /tts` body `{"text": "...", "voice": "zh-CN-XiaoxiaoNeural", "rate": "+0%"}` → 返回 `audio/mpeg`

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
