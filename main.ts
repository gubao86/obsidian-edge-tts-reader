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
import { MsEdgeTTS, OUTPUT_FORMAT, ProsodyOptions } from "msedge-tts";
import { EdgeTTSReaderSettings, DEFAULT_SETTINGS } from "./settings";
import { VOICES } from "./voices";

const PREFETCH_AHEAD = 5;
const BODY_READING_CLASS = "edge-tts-reading";

type Segment = { start: number; end: number; text: string };

export default class EdgeTTSReaderPlugin extends Plugin {
  settings: EdgeTTSReaderSettings;
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

  private stripMarkdown(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/\$\$[\s\S]*?\$\$/g, "")
      .replace(/\$[^$\n]+\$/g, "")
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, alias) => alias || link)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s+/gm, "")
      .replace(/^[-*_]{3,}$/gm, "")
      .replace(/^===+$/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/^\s*\[[ x]\]\s+/gmi, "")
      .replace(/\[\^[^\]]+\]/g, "")
      .replace(/==([^=]+)==/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/\|[^|\n]*\|/g, (match) => match.replace(/\|/g, " "))
      .replace(/[*_~`]/g, "")
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

  async speakText(rawText: string, title: string) {
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

    const queue: (Promise<ArrayBuffer | null> | null)[] = segments.map(() => null);
    const ensureFetched = (idx: number) => {
      if (idx < 0 || idx >= segments.length || queue[idx]) return;
      const cleaned = this.stripMarkdown(segments[idx].text).trim();
      if (!cleaned) {
        queue[idx] = Promise.resolve(null);
      } else {
        queue[idx] = this.synthesize(cleaned).catch((e) => {
          console.error(`段 ${idx} 合成失败:`, e);
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
      const buf = await queue[i]!;
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

  /** 直接连接微软 Edge TTS 服务合成 MP3，无需本地 Python */
  private synthesize(text: string): Promise<ArrayBuffer> {
    return new Promise(async (resolve, reject) => {
      const tts = new MsEdgeTTS();
      try {
        await tts.setMetadata(
          this.settings.voice,
          OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
        );
        const prosody = new ProsodyOptions();
        prosody.rate = this.settings.rate;
        const { audioStream } = tts.toStream(text, prosody);

        const chunks: Buffer[] = [];
        audioStream.on("data", (c: Buffer) => chunks.push(c));
        audioStream.on("end", () => {
          try {
            const buf = Buffer.concat(chunks);
            const ab = buf.buffer.slice(
              buf.byteOffset,
              buf.byteOffset + buf.byteLength
            ) as ArrayBuffer;
            resolve(ab);
          } catch (err) {
            reject(err);
          } finally {
            try { tts.close(); } catch { /* ignore */ }
          }
        });
        audioStream.on("error", (err) => {
          try { tts.close(); } catch { /* ignore */ }
          reject(err);
        });
      } catch (err) {
        try { tts.close(); } catch { /* ignore */ }
        reject(err);
      }
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

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Edge TTS Reader 设置" });

    new Setting(containerEl)
      .setName("音色")
      .setDesc("选择 Microsoft Edge TTS 音色")
      .addDropdown((dd) => {
        for (const id of Object.keys(VOICES)) {
          const v = VOICES[id];
          dd.addOption(id, `${v.name}  [${id}]`);
        }
        if (!VOICES[this.plugin.settings.voice]) {
          dd.addOption(this.plugin.settings.voice, this.plugin.settings.voice);
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
          this.plugin.speakText("你好，这是 Edge TTS 的音色试听。", "试听");
        })
      );
  }
}
