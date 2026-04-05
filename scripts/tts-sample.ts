/**
 * TTS 프로바이더별 샘플 음성 생성 스크립트
 *
 * 사용법:
 *   npx tsx scripts/tts-sample.ts [provider] [speechRate]
 *
 * provider: gemini | google_cloud_tts | gemini_cloud_tts (기본: 현재 AUDIO_PROVIDER)
 * speechRate: 0.5~2.0 (기본: video.json의 tts.speechRate)
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { config } from '../packages/automation/src/infrastructure/config';
import { GeminiAudioProvider } from '../packages/automation/src/infrastructure/providers/GeminiAudioProvider';
import { GoogleCloudTtsProvider } from '../packages/automation/src/infrastructure/providers/GoogleCloudTtsProvider';
import { GeminiCloudTtsProvider } from '../packages/automation/src/infrastructure/providers/GeminiCloudTtsProvider';
import { IAudioProvider } from '../packages/automation/src/domain/interfaces/IAudioProvider';

// 실제 강의 스크립트(p1-01-01.json scene 1)에서 발췌 — 약 30초 분량
const SAMPLE_TEXT =
  '皆さん、こんにちは。「AI時代のWeb制作マスター」へようこそ。' +
  'この講座の講師を務めます。' +
  'これから皆さんと一緒に、約20時間かけて' +
  '「自分だけのWebサイトを作り、インターネットに公開する」までの旅をしていきます。' +
  '最初にお伝えしたいことがあります。' +
  'この講座は、皆さんをプログラマーにするための講座ではありません。';

function createProvider(name: string): IAudioProvider {
  switch (name) {
    case 'gemini': {
      const c = config.providers.gemini;
      if (!c.apiKey) {
        console.error('❌ GEMINI_API_KEY가 설정되어 있지 않습니다.');
        process.exit(1);
      }
      return new GeminiAudioProvider(c.apiKey, c.modelName, c.voice, c.language);
    }
    case 'google_cloud_tts': {
      const c = config.providers.google_cloud_tts;
      if (!c.keyFilePath) {
        console.error('❌ GOOGLE_CLOUD_TTS_KEY_FILE이 설정되어 있지 않습니다.');
        process.exit(1);
      }
      return new GoogleCloudTtsProvider(c.keyFilePath, c.voiceName, c.languageCode);
    }
    case 'gemini_cloud_tts': {
      const c = config.providers.gemini_cloud_tts;
      if (!c.keyFilePath) {
        console.error('❌ GOOGLE_CLOUD_TTS_KEY_FILE이 설정되어 있지 않습니다.');
        process.exit(1);
      }
      return new GeminiCloudTtsProvider(c.keyFilePath, c.modelName, c.voiceName, c.languageCode);
    }
    default:
      console.error(`❌ 알 수 없는 프로바이더: ${name}`);
      console.error('   사용 가능: gemini | google_cloud_tts | gemini_cloud_tts');
      process.exit(1);
  }
}

async function main() {
  const providerName = process.argv[2] || config.active_audio_provider;
  const speechRateArg = process.argv[3] ? parseFloat(process.argv[3]) : null;

  // speechRate가 지정되면 video.json의 tts.speechRate를 런타임 오버라이드
  if (speechRateArg !== null) {
    const origGetTtsConfig = config.getTtsConfig;
    config.getTtsConfig = () => {
      const ttsConfig = origGetTtsConfig();
      return { ...ttsConfig, speechRate: speechRateArg };
    };
  }

  const effectiveRate = config.getTtsConfig().speechRate;
  const outDir = path.join(config.paths.root, 'output', 'tts-samples');
  await fs.ensureDir(outDir);

  console.log(`\n🎤 TTS 샘플 음성 생성`);
  console.log(`   프로바이더: ${providerName}`);
  console.log(`   음성 속도: ${effectiveRate}`);
  console.log(`   텍스트 길이: ${SAMPLE_TEXT.length}자`);
  console.log(`   출력 경로: ${outDir}\n`);

  const provider = createProvider(providerName);
  const startTime = Date.now();
  const result = await provider.generate(SAMPLE_TEXT, { scene_id: 0 });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const voiceName = config.providers[providerName as keyof typeof config.providers]
    ? (config.providers[providerName as keyof typeof config.providers] as any).voiceName
      || (config.providers[providerName as keyof typeof config.providers] as any).voice
      || 'unknown'
    : 'unknown';
  const outFile = path.join(outDir, `sample-${providerName}-${voiceName}-${timestamp}.wav`);
  await fs.writeFile(outFile, result.buffer);

  console.log(`\n🎧 샘플 생성 완료`);
  console.log(`   파일: ${outFile}`);
  console.log(`   길이: ${result.durationSec.toFixed(2)}초`);
  console.log(`   소요: ${elapsed}초\n`);
}

main().catch((err) => {
  console.error('\n❌ 샘플 생성 실패:', err.message || err);
  process.exit(1);
});
