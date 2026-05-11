"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => EdgeTTSReaderPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// settings.ts
var DEFAULT_SETTINGS = {
  voice: "zh-CN-XiaoxiaoNeural",
  rate: "+0%"
};

// main.ts
var TTS_SERVER = "http://localhost:18080";
var PREFETCH_AHEAD = 5;
var BODY_READING_CLASS = "edge-tts-reading";
var EdgeTTSReaderPlugin = class extends import_obsidian.Plugin {
  constructor(app, manifest) {
    super(app, manifest);
    this.voices = {};
    this.audio = null;
    this.isPlaying = false;
    this.statusBarEl = null;
    this.playToken = 0;
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    new import_obsidian.Notice("Edge TTS \u63D2\u4EF6\u5DF2\u52A0\u8F7D");
    this.addCommand({
      id: "read-current-note",
      name: "\u6717\u8BFB\u5F53\u524D\u7B14\u8BB0",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "v" }],
      callback: () => this.readCurrentNote()
    });
    this.addCommand({
      id: "stop-reading",
      name: "\u505C\u6B62\u6717\u8BFB",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "b" }],
      callback: () => this.stopReading()
    });
    this.addRibbonIcon("volume-2", "\u6717\u8BFB\u7B14\u8BB0", () => {
      this.readCurrentNote();
    });
    this.addToolbarButton();
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.setText("Edge TTS");
    this.addSettingTab(new EdgeTTSSettingTab(this.app, this));
    this.loadVoices().catch((e) => console.error("\u52A0\u8F7D\u97F3\u8272\u5217\u8868\u5931\u8D25", e));
  }
  onunload() {
    this.stopReading();
    document.body.classList.remove(BODY_READING_CLASS);
  }
  addToolbarButton() {
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu) => {
        menu.addItem((item) => {
          item.setTitle("\u{1F50A} \u6717\u8BFB\u7B14\u8BB0").onClick(() => {
            this.readCurrentNote();
          });
        });
      })
    );
  }
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData() || {}
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async loadVoices() {
    const resp = await fetch(`${TTS_SERVER}/voices`);
    const data = await resp.json();
    this.voices = data.voices || {};
  }
  stripMarkdown(text) {
    return text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, alias) => alias || link).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[#*_~`>]/g, "").replace(/!\[[^\]]*\]\([^)]+\)/g, "").replace(/^---+$/gm, "").replace(/^===+$/gm, "").replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*\d+\.\s+/gm, "").replace(/\|[^|\n]*\|/g, (match) => match.replace(/\|/g, " ")).replace(/\n{3,}/g, "\n\n").trim();
  }
  splitSentences(raw) {
    const segs = [];
    const re = /[^。！？!?\n]*[。！？!?\n]|[^。！？!?\n]+$/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      if (m[0].length === 0) break;
      if (m[0].trim()) {
        segs.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
      }
    }
    return segs;
  }
  async readCurrentNote() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new import_obsidian.Notice("\u6CA1\u6709\u6253\u5F00\u7684\u7B14\u8BB0");
      return;
    }
    const content = await this.app.vault.read(file);
    if (!content.trim()) {
      new import_obsidian.Notice("\u7B14\u8BB0\u5185\u5BB9\u4E3A\u7A7A");
      return;
    }
    await this.speakText(content, file.basename);
  }
  async speakText(rawText, title) {
    if (this.isPlaying) this.stopReading();
    const segments = this.splitSentences(rawText);
    if (segments.length === 0) {
      new import_obsidian.Notice("\u6CA1\u6709\u53EF\u6717\u8BFB\u7684\u6587\u672C");
      return;
    }
    const token = ++this.playToken;
    this.isPlaying = true;
    this.updateStatusBar("\u{1F50A} " + title);
    document.body.classList.add(BODY_READING_CLASS);
    new import_obsidian.Notice(`\u{1F50A} \u6B63\u5728\u6717\u8BFB: ${title}`);
    const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    const editor = view ? view.editor : null;
    const queue = segments.map(() => null);
    const ensureFetched = (idx) => {
      if (idx < 0 || idx >= segments.length || queue[idx]) return;
      const cleaned = this.stripMarkdown(segments[idx].text).trim();
      if (!cleaned) {
        queue[idx] = Promise.resolve(null);
      } else {
        queue[idx] = this.fetchAudio(cleaned).catch((e) => {
          console.error(`\u6BB5 ${idx} \u53D6\u97F3\u5931\u8D25:`, e);
          return null;
        });
      }
    };
    ensureFetched(0);
    for (let i = 0; i < segments.length; i++) {
      if (token !== this.playToken) {
        this.cleanupReading();
        return;
      }
      const buf = await queue[i];
      if (token !== this.playToken) {
        this.cleanupReading();
        return;
      }
      for (let k = 1; k <= PREFETCH_AHEAD; k++) ensureFetched(i + k);
      if (!buf) continue;
      if (editor) {
        try {
          const from = editor.offsetToPos(segments[i].start);
          const to = editor.offsetToPos(segments[i].end);
          editor.setSelection(from, to);
          editor.scrollIntoView({ from, to }, true);
        } catch {
        }
      }
      await this.playBuffer(buf, token);
    }
    if (token === this.playToken) {
      this.cleanupReading();
    }
  }
  cleanupReading() {
    this.isPlaying = false;
    this.updateStatusBar("Edge TTS");
    document.body.classList.remove(BODY_READING_CLASS);
  }
  fetchAudio(text) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${TTS_SERVER}/tts`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.responseType = "arraybuffer";
      xhr.onload = () => xhr.status === 200 ? resolve(xhr.response) : reject(new Error(`HTTP ${xhr.status}`));
      xhr.onerror = () => reject(new Error("\u7F51\u7EDC\u9519\u8BEF"));
      xhr.onabort = () => reject(new Error("\u8BF7\u6C42\u53D6\u6D88"));
      xhr.send(
        JSON.stringify({
          text,
          voice: this.settings.voice,
          rate: this.settings.rate
        })
      );
    });
  }
  playBuffer(buf, token) {
    return new Promise((resolve) => {
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.audio = audio;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        URL.revokeObjectURL(url);
        if (this.audio === audio) this.audio = null;
        resolve();
      };
      audio.onended = finish;
      audio.onerror = () => {
        console.error("\u97F3\u9891\u64AD\u653E\u9519\u8BEF");
        finish();
      };
      audio.play().catch((e) => {
        console.error("audio.play \u5931\u8D25:", e);
        finish();
      });
      const watcher = window.setInterval(() => {
        if (done) {
          window.clearInterval(watcher);
        } else if (token !== this.playToken) {
          window.clearInterval(watcher);
          audio.pause();
          finish();
        }
      }, 100);
    });
  }
  stopReading() {
    this.playToken++;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.cleanupReading();
    new import_obsidian.Notice("\u5DF2\u505C\u6B62\u6717\u8BFB");
  }
  updateStatusBar(text) {
    if (this.statusBarEl) this.statusBarEl.setText(text);
  }
};
var EdgeTTSSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  async display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Edge TTS Reader \u8BBE\u7F6E" });
    if (!this.plugin.voices || Object.keys(this.plugin.voices).length === 0) {
      try {
        await this.plugin.loadVoices();
      } catch (e) {
        containerEl.createEl("p", {
          text: "\u65E0\u6CD5\u8FDE\u63A5 TTS \u670D\u52A1 (http://localhost:18080)\uFF0C\u8BF7\u786E\u8BA4 tts_server.py \u5728\u8FD0\u884C\u3002"
        });
      }
    }
    new import_obsidian.Setting(containerEl).setName("\u97F3\u8272").setDesc("\u9009\u62E9 Edge TTS \u97F3\u8272").addDropdown((dd) => {
      const voices = this.plugin.voices || {};
      const ids = Object.keys(voices);
      if (ids.length === 0) {
        dd.addOption(this.plugin.settings.voice, this.plugin.settings.voice);
      } else {
        for (const id of ids) {
          const v = voices[id];
          dd.addOption(id, `${v.name}  [${id}]`);
        }
      }
      dd.setValue(this.plugin.settings.voice);
      dd.onChange(async (value) => {
        this.plugin.settings.voice = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("\u8BED\u901F").setDesc("\u8303\u56F4 -50% ~ +100%\uFF080% \u4E3A\u6B63\u5E38\uFF09").addDropdown((dd) => {
      const rates = [
        "-50%",
        "-40%",
        "-30%",
        "-20%",
        "-10%",
        "+0%",
        "+10%",
        "+20%",
        "+30%",
        "+40%",
        "+50%",
        "+75%",
        "+100%"
      ];
      for (const r of rates) dd.addOption(r, r);
      if (!rates.includes(this.plugin.settings.rate)) {
        dd.addOption(this.plugin.settings.rate, this.plugin.settings.rate);
      }
      dd.setValue(this.plugin.settings.rate);
      dd.onChange(async (value) => {
        this.plugin.settings.rate = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("\u8BD5\u542C").setDesc("\u7528\u5F53\u524D\u97F3\u8272\u548C\u8BED\u901F\u6717\u8BFB\u4E00\u53E5\u793A\u4F8B").addButton(
      (btn) => btn.setButtonText("\u25B6 \u8BD5\u542C").onClick(async () => {
        this.plugin.speakText(
          "\u4F60\u597D\uFF0C\u8FD9\u662F Edge TTS \u7684\u97F3\u8272\u8BD5\u542C\u3002",
          "\u8BD5\u542C"
        );
      })
    );
  }
};
