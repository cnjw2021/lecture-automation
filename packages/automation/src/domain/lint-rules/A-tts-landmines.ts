/**
 * 카테고리 A — TTS 지뢰 (provider별 dispatcher).
 *
 * 활성 TTS provider (`config/tts.json` 의 `activeProvider`) 에 따라 적용 사전을
 * 동적으로 선택. 항상 공통 사전 + provider별 사전을 조합한다.
 *
 * 사전 구성:
 * - 공통 (`A-tts-landmines-common.ts`): 엔진 무관 일본어 표기 정규화 (パート1, h1~h6, 焦る 등)
 * - ElevenLabs (`A-tts-landmines-elevenlabs.ts`): Hinata 보이스 자소 오독 (ペン·タグ·p 등)
 * - Fish Audio (`A-tts-landmines-fish.ts`): speech-1.6 영문 발음 오독 (header·footer·#·&copy; 등)
 *
 * 신규 provider 가 추가되면 새 사전 파일을 만들고 `getLandminesForProvider` 의 분기에 등록.
 */

import * as fs from 'fs';
import * as path from 'path';
import { LintIssue, LintRule } from './types';
import { COMMON_LANDMINES, Landmine } from './A-tts-landmines-common';
import { ELEVENLABS_LANDMINES } from './A-tts-landmines-elevenlabs';
import { FISH_LANDMINES } from './A-tts-landmines-fish';

const ROOT_DIR = path.join(__dirname, '../../../../../');
const TTS_CONFIG_PATH = path.join(ROOT_DIR, 'config/tts.json');

/**
 * config/tts.json 의 activeProvider 를 읽는다. 파일이 없거나 읽을 수 없으면
 * 안전 기본값으로 'elevenlabs' 를 반환 (역사적으로 가장 큰 사전을 가진 provider).
 *
 * 도메인 레이어에서 직접 fs 를 읽는 것은 일반적으로 피하지만, lint 룰 데이터셋
 * 선택은 인프라 의존이라기보다 정책 분기에 가깝고 호출 타이밍이 빌드 시점 1회뿐이라
 * 단순 직접 읽기를 선택한다 (`infrastructure/config` 는 의존성 그래프상 더 무겁다).
 */
function readActiveProvider(): string {
  try {
    if (!fs.existsSync(TTS_CONFIG_PATH)) return 'elevenlabs';
    const raw = fs.readFileSync(TTS_CONFIG_PATH, 'utf-8');
    const json = JSON.parse(raw);
    const provider = json?.activeProvider;
    return typeof provider === 'string' && provider.length > 0 ? provider : 'elevenlabs';
  } catch {
    return 'elevenlabs';
  }
}

/**
 * 주어진 provider 에 적용할 landmine 사전을 반환.
 * 항상 공통 사전을 포함하며, provider 별 사전을 추가로 결합한다.
 *
 * 알 수 없는 provider 면 공통 사전만 반환 (대화·확장형 경고 회피).
 */
export function getLandminesForProvider(provider: string): Landmine[] {
  switch (provider) {
    case 'elevenlabs':
      return [...COMMON_LANDMINES, ...ELEVENLABS_LANDMINES];
    case 'fish_audio_api':
    case 'fish_speech':
      return [...COMMON_LANDMINES, ...FISH_LANDMINES];
    default:
      // gemini, google_cloud_tts 등 별도 사전이 정의되지 않은 provider 는 공통만 적용.
      return [...COMMON_LANDMINES];
  }
}

/**
 * Playwright 씬의 syncPoints[*].phrase 도 함께 치환.
 * narration 만 치환하면 phrase 가 narration 안에서 찾을 수 없게 되어
 * D-playwright-shape 룰이 "phrase 가 narration 안에 없음" 으로 차단한다.
 */
function applyToSyncPoints(scene: any, replacer: (s: string) => string) {
  const syncPoints = scene?.visual?.syncPoints;
  if (!Array.isArray(syncPoints)) return;
  for (const sp of syncPoints) {
    if (sp && typeof sp.phrase === 'string') {
      sp.phrase = replacer(sp.phrase);
    }
  }
}

/**
 * 단순 문자열 치환을 적용하는 fix 함수 생성.
 * narration + syncPoints[*].phrase 의 모든 매치를 한 번에 치환한다.
 */
function makeFix(sceneIdx: number, from: string, to: string) {
  return (lecture: any) => {
    const scene = lecture.sequence[sceneIdx];
    if (!scene || typeof scene.narration !== 'string') return;
    const replacer = (s: string) => s.split(from).join(to);
    scene.narration = replacer(scene.narration);
    applyToSyncPoints(scene, replacer);
  };
}

/**
 * 정규식 치환을 적용하는 fix 함수 생성.
 * lookbehind/lookahead 가 필요한 복합어 제외 케이스에 사용.
 */
function makeRegexFix(sceneIdx: number, pattern: RegExp, to: string) {
  return (lecture: any) => {
    const scene = lecture.sequence[sceneIdx];
    if (!scene || typeof scene.narration !== 'string') return;
    const replacer = (s: string) => s.replace(new RegExp(pattern.source, pattern.flags), to);
    scene.narration = replacer(scene.narration);
    applyToSyncPoints(scene, replacer);
  };
}

/**
 * provider 를 받아 동작하는 LintRule 객체를 생성.
 * 기본 export `ttsLandminesRule` 은 매 run() 호출 시 활성 provider 를 다시 읽으므로
 * 활성 provider 를 변경한 뒤 즉시 재실행할 수 있다.
 *
 * 테스트는 `makeTtsLandminesRule('elevenlabs')` 처럼 명시 호출해 활성 설정과 분리한다.
 */
export function makeTtsLandminesRule(providerOverride?: string): LintRule {
  return {
    id: 'A-tts-landmines',
    description: 'TTS 오독 패턴 검출 및 자동 수정 (활성 provider 별 사전을 동적 적용)',
    run(lecture: any): LintIssue[] {
      const provider = providerOverride ?? readActiveProvider();
      const landmines = getLandminesForProvider(provider);
      const issues: LintIssue[] = [];
      if (!lecture?.sequence || !Array.isArray(lecture.sequence)) return issues;

      lecture.sequence.forEach((scene: any, idx: number) => {
        const narration: string = typeof scene?.narration === 'string' ? scene.narration : '';
        const syncPoints: any[] = Array.isArray(scene?.visual?.syncPoints) ? scene.visual.syncPoints : [];
        const phrases: string[] = syncPoints
          .map((sp) => (sp && typeof sp.phrase === 'string' ? sp.phrase : ''))
          .filter(Boolean);

        for (const lm of landmines) {
          const narrMatches = narration ? narration.match(lm.pattern) : null;
          const phraseMatches = phrases.flatMap((p) => p.match(lm.pattern) || []);
          const total = (narrMatches?.length ?? 0) + phraseMatches.length;
          if (total === 0) continue;

          const sourceForContext = narration.includes(lm.from)
            ? narration
            : (phrases.find((p) => p.includes(lm.from)) ?? '');

          issues.push({
            ruleId: 'A-tts-landmines',
            sceneId: scene.scene_id ?? null,
            severity: 'error',
            message: `「${lm.from}」→「${lm.to}」(${lm.reason}) — ${total}회`,
            context: extractContext(sourceForContext, lm.from),
            fix: lm.fixPattern
              ? makeRegexFix(idx, lm.fixPattern, lm.to)
              : makeFix(idx, lm.from, lm.to),
            fixDescription: `「${lm.from}」→「${lm.to}」`,
          });
        }
      });

      return issues;
    },
  };
}

/** 활성 provider 사전을 적용하는 기본 룰. CLI 에서 import 해서 사용한다. */
export const ttsLandminesRule: LintRule = makeTtsLandminesRule();

function extractContext(text: string, needle: string): string {
  const idx = text.indexOf(needle);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 10);
  const end = Math.min(text.length, idx + needle.length + 10);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}
