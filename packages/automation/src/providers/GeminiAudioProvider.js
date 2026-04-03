const fs = require('fs-extra');
const path = require('path');
const AudioProvider = require('./AudioProvider');
const videoConfig = require('../../../../config/video.json');

class GeminiAudioProvider extends AudioProvider {
  constructor(apiKey, modelName) {
    super();
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
  }

  pcmToWav(pcmData) {
    const { sampleRate, channels, bitDepth } = videoConfig.audio;
    const sampleWidth = bitDepth / 8;
    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * sampleWidth, 28);
    header.writeUInt16LE(channels * sampleWidth, 32);
    header.writeUInt16LE(sampleWidth * 8, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    const buffer = Buffer.concat([header, pcmData]);
    const durationSec = dataSize / (sampleRate * channels * sampleWidth);

    return { buffer, durationSec };
  }

  async generate(text, { scene_id } = {}) {
    console.log(`[Gemini TTS] Scene ${scene_id || 'unknown'} 음성 생성 시도 (${this.modelName})...`);
    
    const sanitizedText = text.length < 15 ? text + "..." : text;
    const url = `${this.baseUrl}/${this.modelName}:generateContent?key=${this.apiKey}`;

    const payload = {
      contents: [{
        parts: [{ text: "Read aloud naturally: " + sanitizedText }]
      }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Puck"
            }
          }
        }
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        // 404가 발생하면 모델 이름을 gemini-2.5-flash (v1에서 확인된 것)로 자동 변경 추천 로그
        if (response.status === 404) {
           console.error(`  ⚠️ 모델 ${this.modelName}이 존재하지 않습니다. gemini-2.5-flash로 시도해보세요.`);
        }
        throw new Error(`Gemini API Error (${this.modelName}): ${response.status} - ${JSON.stringify(result)}`);
      }

      if (result.candidates && result.candidates[0].content.parts) {
        const audioPart = result.candidates[0].content.parts.find(p => p.inlineData);
        if (audioPart) {
          const pcmBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
          const { buffer, durationSec } = this.pcmToWav(pcmBuffer);
          console.log(`  ✅ 오디오 생성 완료 (${pcmBuffer.length} bytes, ${durationSec.toFixed(2)}초)`);
          return { buffer, durationSec };
        }
      }

      throw new Error(`오디오 데이터를 수신하지 못했습니다. 응답: ${JSON.stringify(result).substring(0, 100)}`);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = GeminiAudioProvider;
