import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * Playwright `right_click` / `capture` 액션이 추출한 페이지 상태(요소 attribute, URL 등)를
 * 디스크에 저장하고, 후속 씬에서 ${capture:key} placeholder 로 치환할 수 있게 한다.
 *
 * 저장 위치: tmp/playwright-captures/{lectureId}/{key}.json
 * 파일 내용: { value: string, capturedAt: ISO8601, sceneId?: number, sourceCmd?: string }
 *
 * 모의값(mock) 메커니즘:
 *   - sync-preview 등 TTS 전 단계는 실제 capture 가 없을 수 있다.
 *   - {lectureId}/.mock.json 에 { [key]: value } 를 두면 missing key 에 대해 fallback 으로 사용된다.
 *   - mock 도 없으면 expandCapturePlaceholders 가 throw → 호출자가 비치명적으로 처리할지 결정.
 */

const CAPTURE_DIR_NAME = 'playwright-captures';
const MOCK_FILE_NAME = '.mock.json';

export interface CaptureRecord {
  value: string;
  capturedAt: string;
  sceneId?: number;
  sourceCmd?: string;
}

export interface CaptureStoreOptions {
  /** 프로젝트 루트 경로 (생략 시 process.cwd()) */
  projectRoot?: string;
}

function resolveCaptureDir(lectureId: string, options: CaptureStoreOptions = {}): string {
  const root = options.projectRoot ?? process.cwd();
  return path.join(root, 'tmp', CAPTURE_DIR_NAME, lectureId);
}

function resolveCaptureFile(lectureId: string, key: string, options: CaptureStoreOptions = {}): string {
  return path.join(resolveCaptureDir(lectureId, options), `${key}.json`);
}

export async function saveCapture(
  lectureId: string,
  key: string,
  value: string,
  meta: { sceneId?: number; sourceCmd?: string } = {},
  options: CaptureStoreOptions = {},
): Promise<void> {
  if (!lectureId) throw new Error('saveCapture: lectureId 가 비어 있습니다');
  if (!key) throw new Error('saveCapture: key 가 비어 있습니다');
  const dir = resolveCaptureDir(lectureId, options);
  await fs.ensureDir(dir);
  const record: CaptureRecord = {
    value,
    capturedAt: new Date().toISOString(),
    ...meta,
  };
  await fs.writeJson(resolveCaptureFile(lectureId, key, options), record, { spaces: 2 });
}

export async function loadCapture(
  lectureId: string,
  key: string,
  options: CaptureStoreOptions = {},
): Promise<string | null> {
  const file = resolveCaptureFile(lectureId, key, options);
  if (!(await fs.pathExists(file))) return null;
  const record = (await fs.readJson(file)) as CaptureRecord;
  return record.value ?? null;
}

async function loadMock(
  lectureId: string,
  options: CaptureStoreOptions = {},
): Promise<Record<string, string>> {
  const mockFile = path.join(resolveCaptureDir(lectureId, options), MOCK_FILE_NAME);
  if (!(await fs.pathExists(mockFile))) return {};
  const data = await fs.readJson(mockFile);
  return typeof data === 'object' && data !== null ? (data as Record<string, string>) : {};
}

const PLACEHOLDER_PATTERN = /\$\{capture:([a-zA-Z0-9_-]+)\}/g;

export interface ExpandOptions extends CaptureStoreOptions {
  /**
   * mock fallback 모드:
   *   - 'mock-only': capture 가 없고 mock 도 없으면 키 이름을 그대로 길이 더미로 사용 (sync-preview 용)
   *   - 'strict':    capture 또는 mock 둘 중 하나 없으면 throw (실제 실행 모드)
   */
  missingMode?: 'mock-only' | 'strict';
}

/**
 * text 안의 ${capture:key} placeholder 를 캡처값(또는 mock) 으로 치환한다.
 * placeholder 가 없으면 원본 그대로 반환.
 */
export async function expandCapturePlaceholders(
  lectureId: string,
  text: string,
  options: ExpandOptions = {},
): Promise<string> {
  if (!text) return text;
  if (!PLACEHOLDER_PATTERN.test(text)) return text;
  // RegExp.test 가 lastIndex 를 진행시키므로 reset
  PLACEHOLDER_PATTERN.lastIndex = 0;

  const missingMode = options.missingMode ?? 'strict';
  const mockMap = await loadMock(lectureId, options);

  const keys = new Set<string>();
  let match: RegExpExecArray | null;
  PLACEHOLDER_PATTERN.lastIndex = 0;
  while ((match = PLACEHOLDER_PATTERN.exec(text)) !== null) {
    keys.add(match[1]);
  }

  const resolved: Record<string, string> = {};
  for (const key of keys) {
    const captured = await loadCapture(lectureId, key, options);
    if (captured !== null) {
      resolved[key] = captured;
      continue;
    }
    if (mockMap[key] !== undefined) {
      resolved[key] = mockMap[key];
      continue;
    }
    if (missingMode === 'strict') {
      throw new Error(
        `expandCapturePlaceholders: 캡처값 없음 (lectureId=${lectureId}, key=${key}). ` +
          `이전 씬의 right_click/capture 가 실행되지 않았거나 saveAs 가 일치하지 않습니다. ` +
          `sync-preview 등에서는 tmp/playwright-captures/${lectureId}/.mock.json 으로 mock 값을 제공하세요.`,
      );
    }
    // mock-only fallback: sync-preview 의 길이 추정용 더미. 실제 의미 없는 값.
    resolved[key] = `__capture_${key}__`;
  }

  return text.replace(PLACEHOLDER_PATTERN, (_full, key: string) => resolved[key]);
}

/** text 안에 ${capture:...} placeholder 가 하나라도 있는지 검사 */
export function hasCapturePlaceholder(text: string | undefined | null): boolean {
  if (!text) return false;
  PLACEHOLDER_PATTERN.lastIndex = 0;
  return PLACEHOLDER_PATTERN.test(text);
}

/** 텍스트에서 모든 placeholder 키를 추출 (lint 용) */
export function extractCaptureKeys(text: string | undefined | null): string[] {
  if (!text) return [];
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  PLACEHOLDER_PATTERN.lastIndex = 0;
  while ((match = PLACEHOLDER_PATTERN.exec(text)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

/**
 * 강의의 모든 캡처값과 mock 을 한 번에 로드한다.
 * sync-preview / sync-playwright 에서 작업 시작 시 1 회 호출.
 */
export async function loadAllCapturesForLecture(
  lectureId: string,
  options: CaptureStoreOptions = {},
): Promise<Record<string, string>> {
  const dir = resolveCaptureDir(lectureId, options);
  const result: Record<string, string> = {};
  if (!(await fs.pathExists(dir))) return result;

  // mock 값을 baseline 으로
  Object.assign(result, await loadMock(lectureId, options));

  // 실제 캡처가 mock 을 덮어쓰기
  const entries = await fs.readdir(dir);
  for (const entry of entries) {
    if (!entry.endsWith('.json') || entry.startsWith('.')) continue;
    const file = path.join(dir, entry);
    try {
      const record = (await fs.readJson(file)) as CaptureRecord;
      if (record && typeof record.value === 'string') {
        const key = entry.replace(/\.json$/, '');
        result[key] = record.value;
      }
    } catch {
      // 파일 손상 무시
    }
  }
  return result;
}

/**
 * 미리 로드한 캡처/mock map 으로 placeholder 를 동기 치환한다.
 * sync-preview 의 estimator 가 한 씬당 여러 액션을 반복 처리할 때 사용.
 *
 * @param missingFallback  missing key 발생 시 대체 텍스트 생성 함수.
 *                          기본은 placeholder 원문 유지 (length 기반 추산이 placeholder 길이를 따른다).
 */
export function expandWithMap(
  text: string | undefined | null,
  resolvedMap: Record<string, string>,
  missingFallback?: (key: string) => string,
): string {
  if (!text) return text ?? '';
  if (!text.includes('${capture:')) return text;
  return text.replace(PLACEHOLDER_PATTERN, (_full, key: string) => {
    if (resolvedMap[key] !== undefined) return resolvedMap[key];
    if (missingFallback) return missingFallback(key);
    return `\${capture:${key}}`;
  });
}
