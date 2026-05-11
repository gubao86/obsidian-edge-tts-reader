export interface EdgeTTSReaderSettings {
  voice: string;
  rate: string;
}

export const DEFAULT_SETTINGS: EdgeTTSReaderSettings = {
  voice: "zh-CN-XiaoxiaoNeural",
  rate: "+0%",
};
