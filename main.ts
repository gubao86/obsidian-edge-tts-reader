import {
  App,
  Plugin,
  PluginManifest,
  PluginSettingTab,
  Setting,
  Notice,
  MarkdownView,
  Editor,
} from "obsidian";
import { EdgeTTSReaderSettings, DEFAULT_SETTINGS } from "./settings";

const TTS_SERVER = "http://localhost:18080";
const PREFETCH_AHEAD = 5;
const BODY_READING_CLASS = "edge-tts-reading";

type VoiceInfo = { name: string; gender: string; lang: string };
type Segment = { start: number; end: number; text: string };

export default class EdgeTTSReaderPlugin extends Plugin {
  settings: EdgeTTSReaderSettings;
  voices: Record<string, VoiceInfo> = {};
  private audio: HTMLAudioElement | null = null;
  private isPlaying = false;
  private statusBarEl: HTMLElement | null = null;
  private playToken = 0;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.settings = DEFAULT_SETTINGS;
  }

  async onload() {
    await this.loadSettings();

    new Notice("Edge TTS 插件已加载");

    this.addCommand({
      id: "read-current-note",
      name: "朗读当前笔记",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "v" }],
      callback: () => this.readCurrentNote(),
    });

    this.addCommand({
      id: "stop-reading",
      name: "停止朗读",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "b" }],
      callback: () => this.stopReading(),
    });

    this.addRibbonIcon("volume-2", "朗读笔记", () => {
      this.readCurrentNote();
    });

    this.addToolbarButton();
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.setText("Edge TTS");

    this.addSettingTab(new EdgeTTSSettingTab(this.app, this));

    // 异步加载音色列表（不阻塞）
    this.loadVoices().catch((e) => console.error("加载音色列表失败", e));
  }

  onunload() {
    this.stopReading();
    document.body.classList.remove(BODY_READING_CLASS);
  }

  private addToolbarButton() {
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu) => {
        menu.addItem((item) => {
          item.setTitle("🔊 朗读笔记").onClick(() => {
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
      (await this.loadData()) || {}
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

  private stripMarkdown(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, alias) => alias || link)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_~`>]/g, "")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/^---+$/gm, "")
      .replace(/^===+$/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/\|[^|\n]*\|/g, (match) => match.replace(/\|/g, " "))
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private splitSentences(raw: string): Segment[] {
    const segs: Segment[] = [];
    const re = /[^。！？!?\n]*[。！？!?\n]|[^。！？!?\n]+$/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      if (m[0].length === 0) break;
      if (m[0].trim()) {
        segs.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
      }
    }
    return segs;
  }

  private async readCurrentNote() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("没有打开的笔记");
      return;
    }
    const content = await this.app.vault.read(file);
    if (!content.trim()) {
      new Notice("笔记内容为空");
      return;
    }
    await this.speakText(content, file.basename);
  }

  private async speakText(rawText: string, title: string) {
    if (this.isPlaying) this.stopReading();

    const segments = this.splitSentences(rawText);
    if (segments.length === 0) {
      new Notice("没有可朗读的文本");
      return;
    }

    const token = ++this.playToken;
    this.isPlaying = true;
    this.updateStatusBar("🔊 " + title);
    document.body.classList.add(BODY_READING_CLASS);
    new Notice(`🔊 正在朗读: ${title}`);

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor: Editor | null = view ? view.editor : null;

    // 预取队列：每个段落一个 Promise<ArrayBuffer | null>
    const queue: (Promise<ArrayBuffer | null> | null)[] = segments.map(() => null);
    const ensureFetched = (idx: number) => {
      if (idx < 0 || idx >= segments.length || queue[idx]) return;
      const cleaned = this.stripMarkdown(segments[idx].text).trim();
      if (!cleaned) {
        queue[idx] = Promise.resolve(null);
      } else {
        queue[idx] = this.fetchAudio(cleaned).catch((e) => {
          console.error(`段 ${idx} 取音失败:`, e);
          return null;
        });
      }
    };

    // 第一次只取 1 句
    ensureFetched(0);

    for (let i = 0; i < segments.length; i++) {
      if (token !== this.playToken) {
        this.cleanupReading();
        return;
      }

      const buf = await queue[i]!;
      if (token !== this.playToken) {
        this.cleanupReading();
        return;
      }

      // 一旦开始播放当前句，就向前预取 5 句
      for (let k = 1; k <= PREFETCH_AHEAD; k++) ensureFetched(i + k);

      if (!buf) continue;

      // 高亮当前句
      if (editor) {
        try {
          const from = editor.offsetToPos(segments[i].start);
          const to = editor.offsetToPos(segments[i].end);
          editor.setSelection(from, to);
          editor.scrollIntoView({ from, to }, true);
        } catch {
          // ignore
        }
      }

      await this.playBuffer(buf, token);
    }

    if (token === this.playToken) {
      this.cleanupReading();
    }
  }

  private cleanupReading() {
    this.isPlaying = false;
    this.updateStatusBar("Edge TTS");
    document.body.classList.remove(BODY_READING_CLASS);
  }

  private fetchAudio(text: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${TTS_SERVER}/tts`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.responseType = "arraybuffer";
      xhr.onload = () =>
        xhr.status === 200
          ? resolve(xhr.response)
          : reject(new Error(`HTTP ${xhr.status}`));
      xhr.onerror = () => reject(new Error("网络错误"));
      xhr.onabort = () => reject(new Error("请求取消"));
      xhr.send(
        JSON.stringify({
          text,
          voice: this.settings.voice,
          rate: this.settings.rate,
        })
      );
    });
  }

  private playBuffer(buf: ArrayBuffer, token: number): Promise<void> {
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
        console.error("音频播放错误");
        finish();
      };
      audio.play().catch((e) => {
        console.error("audio.play 失败:", e);
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

  private stopReading() {
    this.playToken++;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.cleanupReading();
    new Notice("已停止朗读");
  }

  private updateStatusBar(text: string) {
    if (this.statusBarEl) this.statusBarEl.setText(text);
  }
}

class EdgeTTSSettingTab extends PluginSettingTab {
  plugin: EdgeTTSReaderPlugin;

  constructor(app: App, plugin: EdgeTTSReaderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Edge TTS Reader 设置" });

    // 音色还没加载就先加载一次
    if (!this.plugin.voices || Object.keys(this.plugin.voices).length === 0) {
      try {
        await this.plugin.loadVoices();
      } catch (e) {
        containerEl.createEl("p", {
          text: "无法连接 TTS 服务 (http://localhost:18080)，请确认 tts_server.py 在运行。",
        });
      }
    }

    new Setting(containerEl)
      .setName("音色")
      .setDesc("选择 Edge TTS 音色")
      .addDropdown((dd) => {
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

    new Setting(containerEl)
      .setName("语速")
      .setDesc("范围 -50% ~ +100%（0% 为正常）")
      .addDropdown((dd) => {
        const rates = [
          "-50%", "-40%", "-30%", "-20%", "-10%",
          "+0%",
          "+10%", "+20%", "+30%", "+40%", "+50%",
          "+75%", "+100%",
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

    new Setting(containerEl)
      .setName("试听")
      .setDesc("用当前音色和语速朗读一句示例")
      .addButton((btn) =>
        btn.setButtonText("▶ 试听").onClick(async () => {
          (this.plugin as any).speakText(
            "你好，这是 Edge TTS 的音色试听。",
            "试听"
          );
        })
      );
  }
}
