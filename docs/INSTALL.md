# 自研 Obsidian 插件安装指南

本文档系统整理 **把自己开发的 Obsidian 插件部署到 vault** 的各种方式。

## 0. 关键概念：插件的加载位置

Obsidian **不会** 扫描以下目录：

- `~/.obsidian/plugins/`（这只是用户级配置目录，**不是**插件搜索路径）
- `/opt/Obsidian/`（这是 Obsidian **程序本体**的安装目录，与你的笔记和插件无关）

Obsidian **只会** 从这里加载插件：

```text
<你的 vault 根目录>/.obsidian/plugins/<plugin-id>/
```

每个 vault 都有自己独立的 `.obsidian/plugins/`，互相不共享。
插件 `id` 必须与 `manifest.json` 里的 `id` 字段一致。

每个插件目录至少需要三样东西：

- `manifest.json` —— 插件清单（id、name、version、main 等）
- `main.js` —— 已编译的入口文件（TS 必须先打包）
- `styles.css` —— 可选，CSS 样式

> 启用插件还需要在 Obsidian 设置里**关闭"安全模式 / 受限模式"**，否则第三方插件不会被加载。

---

## 方式 A：手动拷贝（最稳，推荐普通使用）

适合：一次性安装，或发版给别人用。

```bash
# 假设你的 vault 在 ~/Documents/MyVault
VAULT=~/Documents/MyVault
PLUGIN_ID=edge-tts-reader

mkdir -p "$VAULT/.obsidian/plugins/$PLUGIN_ID"
cp manifest.json main.js styles.css "$VAULT/.obsidian/plugins/$PLUGIN_ID/"
```

然后在 Obsidian：

1. 设置 → 第三方插件 → 关闭"安全模式"
2. 设置 → 第三方插件 → 已安装的插件 → 启用 `Edge TTS Reader`

**更新插件**：重新拷贝这三个文件，然后在 Obsidian 命令面板执行 `Reload app without saving`。

---

## 方式 B：符号链接（开发期最优）

适合：你在一个固定路径里维护源码，希望改完就生效，不想反复拷贝。

```bash
# 源码目录（你开发的位置）
SRC=~/code/obsidian-edge-tts-reader

# 目标 vault
VAULT=~/Documents/MyVault
PLUGIN_ID=edge-tts-reader

# 删除已有目录（如果存在）
rm -rf "$VAULT/.obsidian/plugins/$PLUGIN_ID"

# 建立符号链接，让 vault 直接指向源码目录
ln -s "$SRC" "$VAULT/.obsidian/plugins/$PLUGIN_ID"
```

之后你每次：

```bash
cd "$SRC"
npm run build        # 重新打包 main.js
```

再在 Obsidian 里 `Ctrl+P` → `Reload app without saving`，新版本立即生效。

**多个 vault 都想用**：每个 vault 都做一次 `ln -s` 即可，链接到同一份源码。

---

## 方式 C：通过 BRAT 自动更新（推荐发布给他人）

[BRAT (Beta Reviewer's Auto-update Tool)](https://github.com/TfTHacker/obsidian42-brat) 是一个第三方插件，能从 GitHub 仓库自动拉取并更新你的插件，不需要进入官方插件市场。

### 一次性准备

1. 在 GitHub 创建仓库（例如 `username/obsidian-edge-tts-reader`），把本仓库代码推上去。
2. 仓库**根目录**必须包含编译后的 `main.js`、`manifest.json`、`styles.css`。
3. 在 GitHub Releases 中**新建一个 Release**，tag 与 `manifest.json` 中的 `version` 完全一致（例如 `1.0.0`，**不要加 `v` 前缀**），把这三个文件作为 release 资产上传。

### 终端用户操作

1. 在 Obsidian 安装并启用 BRAT 插件。
2. 命令面板执行：`BRAT: Add a beta plugin for testing`。
3. 输入仓库地址，例如：`username/obsidian-edge-tts-reader`。
4. BRAT 会自动下载到 `<vault>/.obsidian/plugins/edge-tts-reader/` 并启用。

后续在 BRAT 设置里点 `Check for updates` 就能自动拉新版。

---

## 方式 D：全局源码 + 每个 vault 软链

适合：你在多个 vault 之间共享一份本地源码。

```bash
# 一份源码（全局）
SRC=~/.local/share/obsidian-plugins/edge-tts-reader

# vault 列表
for VAULT in ~/Documents/Vault1 ~/Documents/Vault2; do
  rm -rf "$VAULT/.obsidian/plugins/edge-tts-reader"
  ln -s "$SRC" "$VAULT/.obsidian/plugins/edge-tts-reader"
done
```

每个 vault 仍需要**单独在设置里启用一次插件**（Obsidian 把启用列表写在每个 vault 的 `community-plugins.json` 里）。

---

## 常见排错

### 1. 启用插件后没反应

打开开发者工具（`Ctrl+Shift+I`），查看 `Console`：

- `Plugin requires Obsidian X.X.X` → `manifest.json` 的 `minAppVersion` 高于当前 Obsidian。
- `main.js not found` → 没拷贝 `main.js`，或路径错误。
- TypeError / 红字堆栈 → 看堆栈定位到自己源码的错误。

### 2. 修改后没生效

- 没运行 `npm run build`？`main.js` 没更新？
- 用 `Reload app without saving` 命令；或者在插件设置里把插件**关掉再开**。

### 3. 找不到 `manifest.json`

`manifest.json` 至少包含：

```json
{
  "id": "edge-tts-reader",
  "name": "Edge TTS Reader",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "用本地 Edge TTS 服务朗读笔记",
  "author": "aluo",
  "isDesktopOnly": true
}
```

---

## 打包分发

把以下三个文件打成一个 zip：

```bash
zip -j edge-tts-reader-1.0.0.zip manifest.json main.js styles.css
```

终端用户解压到 `<vault>/.obsidian/plugins/edge-tts-reader/` 即可。
