export type VoiceInfo = { name: string; gender: "Female" | "Male"; lang: string };

export const VOICES: Record<string, VoiceInfo> = {
  // 中文女声
  "zh-CN-XiaoxiaoNeural": { name: "晓晓 (女声-温暖)", gender: "Female", lang: "zh-CN" },
  "zh-CN-XiaoyiNeural": { name: "晓伊 (女声-活泼)", gender: "Female", lang: "zh-CN" },
  "zh-CN-liaoning-XiaobeiNeural": { name: "小北 (东北话-幽默)", gender: "Female", lang: "zh-CN" },
  "zh-CN-shaanxi-XiaoniNeural": { name: "小妮 (陕西话)", gender: "Female", lang: "zh-CN" },
  "zh-HK-HiuGaaiNeural": { name: "HiuGaai (粤语-女)", gender: "Female", lang: "zh-HK" },
  "zh-HK-HiuMaanNeural": { name: "HiuMaan (粤语-女)", gender: "Female", lang: "zh-HK" },
  "zh-TW-HsiaoChenNeural": { name: "小珍 (台湾话-女)", gender: "Female", lang: "zh-TW" },
  "zh-TW-HsiaoYuNeural": { name: "晓予 (台湾话-女)", gender: "Female", lang: "zh-TW" },
  // 中文男声
  "zh-CN-YunjianNeural": { name: "云健 (男声-体育)", gender: "Male", lang: "zh-CN" },
  "zh-CN-YunxiNeural": { name: "云希 (男声-阳光)", gender: "Male", lang: "zh-CN" },
  "zh-CN-YunxiaNeural": { name: "云夏 (男声-可爱)", gender: "Male", lang: "zh-CN" },
  "zh-CN-YunyangNeural": { name: "云扬 (男声-新闻)", gender: "Male", lang: "zh-CN" },
  "zh-HK-WanLungNeural": { name: "WanLung (粤语-男)", gender: "Male", lang: "zh-HK" },
  "zh-TW-YunJheNeural": { name: "云哲 (台湾话-男)", gender: "Male", lang: "zh-TW" },
};
