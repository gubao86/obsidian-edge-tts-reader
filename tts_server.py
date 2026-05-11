#!/usr/bin/env python3
"""
本地 TTS 服务 - 使用 Microsoft Edge TTS
运行方式: python3 tts_server.py
API 地址: http://localhost:18080/tts
"""

from flask import Flask, request, Response
from flask_cors import CORS
import edge_tts
import asyncio
import threading
import concurrent.futures

app = Flask(__name__)
CORS(app)

# Thread pool for running async code
executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

# 可用音色列表
VOICES = {
    # 中文女声
    "zh-CN-XiaoxiaoNeural": {"name": "晓晓 (女声-温暖)", "gender": "Female", "lang": "zh-CN"},
    "zh-CN-XiaoyiNeural": {"name": "晓伊 (女声-活泼)", "gender": "Female", "lang": "zh-CN"},
    "zh-CN-liaoning-XiaobeiNeural": {"name": "小北 (东北话-幽默)", "gender": "Female", "lang": "zh-CN"},
    "zh-CN-shaanxi-XiaoniNeural": {"name": "小妮 (陕西话)", "gender": "Female", "lang": "zh-CN"},
    "zh-HK-HiuGaaiNeural": {"name": "HiuGaai (粤语-女)", "gender": "Female", "lang": "zh-HK"},
    "zh-HK-HiuMaanNeural": {"name": "HiuMaan (粤语-女)", "gender": "Female", "lang": "zh-HK"},
    "zh-TW-HsiaoChenNeural": {"name": "小珍 (台湾话-女)", "gender": "Female", "lang": "zh-TW"},
    "zh-TW-HsiaoYuNeural": {"name": "晓予 (台湾话-女)", "gender": "Female", "lang": "zh-TW"},
    # 中文男声
    "zh-CN-YunjianNeural": {"name": "云健 (男声-体育)", "gender": "Male", "lang": "zh-CN"},
    "zh-CN-YunxiNeural": {"name": "云希 (男声-阳光)", "gender": "Male", "lang": "zh-CN"},
    "zh-CN-YunxiaNeural": {"name": "云夏 (男声-可爱)", "gender": "Male", "lang": "zh-CN"},
    "zh-CN-YunyangNeural": {"name": "云扬 (男声-新闻)", "gender": "Male", "lang": "zh-CN"},
    "zh-HK-WanLungNeural": {"name": "WanLung (粤语-男)", "gender": "Male", "lang": "zh-HK"},
    "zh-TW-YunJheNeural": {"name": "云哲 (台湾话-男)", "gender": "Male", "lang": "zh-TW"},
}


@app.route("/")
def index():
    return """
    <html>
    <head><meta charset="utf-8"><title>本地 TTS 服务</title></head>
    <body>
        <h2>本地 TTS 服务已启动</h2>
        <p>API 端点: <code>POST /tts</code></p>
        <h3>可用音色:</h3>
        <table border="1" cellpadding="5">
            <tr><th>Voice ID</th><th>名称</th><th>性别</th><th>语言</th></tr>
            <tr><td colspan="4"><b>中文女声</b></td></tr>
            <tr><td>zh-CN-XiaoxiaoNeural</td><td>晓晓 (女声-温暖)</td><td>Female</td><td>普通话</td></tr>
            <tr><td>zh-CN-XiaoyiNeural</td><td>晓伊 (女声-活泼)</td><td>Female</td><td>普通话</td></tr>
            <tr><td>zh-CN-liaoning-XiaobeiNeural</td><td>小北 (东北话)</td><td>Female</td><td>东北话</td></tr>
            <tr><td>zh-CN-shaanxi-XiaoniNeural</td><td>小妮 (陕西话)</td><td>Female</td><td>陕西话</td></tr>
            <tr><td>zh-HK-HiuGaaiNeural</td><td>HiuGaai</td><td>Female</td><td>粤语</td></tr>
            <tr><td>zh-HK-HiuMaanNeural</td><td>HiuMaan</td><td>Female</td><td>粤语</td></tr>
            <tr><td colspan="4"><b>中文男声</b></td></tr>
            <tr><td>zh-CN-YunjianNeural</td><td>云健 (男声-体育)</td><td>Male</td><td>普通话</td></tr>
            <tr><td>zh-CN-YunxiNeural</td><td>云希 (男声-阳光)</td><td>Male</td><td>普通话</td></tr>
            <tr><td>zh-CN-YunxiaNeural</td><td>云夏 (男声-可爱)</td><td>Male</td><td>普通话</td></tr>
            <tr><td>zh-CN-YunyangNeural</td><td>云扬 (男声-新闻)</td><td>Male</td><td>普通话</td></tr>
            <tr><td>zh-HK-WanLungNeural</td><td>WanLung</td><td>Male</td><td>粤语</td></tr>
            <tr><td>zh-TW-YunJheNeural</td><td>云哲</td><td>Male</td><td>台湾话</td></tr>
        </table>
        <h3>使用方法:</h3>
        <pre>
POST /tts
Content-Type: application/json

{
    "text": "要转换的文字",
    "voice": "zh-CN-XiaoxiaoNeural",
    "rate": "+0%",
    "volume": "+0%"
}

rate: 语速，如 "+0%" (正常), "+20%" (快20%), "-20%" (慢20%)
volume: 音量，如 "+0%" (正常), "+50%" (大50%), "-50%" (小50%)
        </pre>
        <h3>示例:</h3>
        <pre>
curl -X POST http://localhost:18080/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "你好，这是测试", "voice": "zh-CN-YunxiNeural", "rate": "+0%"}' \
  --output test.mp3
        </pre>
    </body>
    </html>
    """


@app.route("/voices", methods=["GET"])
def list_voices():
    """返回可用音色列表"""
    return {"voices": VOICES}


@app.route("/tts", methods=["POST"])
def text_to_speech():
    """将文字转为语音"""
    data = request.get_json()

    if not data or "text" not in data:
        return {"error": "缺少 text 参数"}, 400

    text = data["text"]
    voice = data.get("voice", "zh-CN-XiaoxiaoNeural")
    rate = data.get("rate", "+0%")
    volume = data.get("volume", "+0%")

    if voice not in VOICES:
        return {"error": f"不支持的音色: {voice}"}, 400

    async def generate_audio():
        communicate = edge_tts.Communicate(text, voice, rate=rate, volume=volume)
        audio_data = b""
        async for chunk in communicate.stream():
            if isinstance(chunk, dict) and chunk.get("type") == "audio":
                audio_data += chunk["data"]
        return audio_data

    def run_async():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(generate_audio())
        finally:
            loop.close()

    try:
        audio_data = run_async()
        return Response(audio_data, mimetype="audio/mpeg")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}, 500


if __name__ == "__main__":
    print("=" * 50)
    print("本地 TTS 服务")
    print("=" * 50)
    print("启动地址: http://localhost:18080")
    print("API 端点: http://localhost:18080/tts")
    print("音色列表: http://localhost:18080/voices")
    print()
    print("按 Ctrl+C 停止服务")
    print("=" * 50)
    app.run(host="0.0.0.0", port=18080, debug=False)
