import { ZodError } from 'zod';
import { REMOTION_PROPS_SCHEMAS } from './remotionPropsSchemas';

export type ValidationMode = 'warning' | 'strict';

export interface PropValidationIssue {
  sceneId: number;
  component: string;
  path: string;
  message: string;
}

export interface PropValidationResult {
  issues: PropValidationIssue[];
  hasErrors: boolean;
}

/**
 * Remotion 씬 배열의 props를 schema registry 기준으로 검증한다.
 *
 * mode === 'warning' : 오류가 있어도 예외를 던지지 않고 issues 배열로 반환
 * mode === 'strict'  : 오류가 하나라도 있으면 예외를 던짐
 */
export function validateRemotionVisualProps(
  scenes: Array<{ scene_id: number; visual: { type: string; component?: string; props?: Record<string, any> } }>,
  mode: ValidationMode = 'warning',
): PropValidationResult {
  const issues: PropValidationIssue[] = [];

  for (const scene of scenes) {
    const { visual, scene_id } = scene;
    if (visual.type !== 'remotion') continue;

    const component = visual.component ?? '';
    const schema = REMOTION_PROPS_SCHEMAS[component];

    if (!schema) {
      // 존재하지 않는 컴포넌트 참조는 ValidateLectureUseCase에서 별도 처리
      continue;
    }

    const result = schema.safeParse(visual.props ?? {});
    if (result.success) continue;

    const error = result.error as ZodError;
    for (const issue of error.issues) {
      issues.push({
        sceneId: scene_id,
        component,
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      });
    }
  }

  const hasErrors = issues.length > 0;

  if (hasErrors && mode === 'strict') {
    const summary = issues
      .map(i => `  scene ${i.sceneId} [${i.component}] .${i.path}: ${i.message}`)
      .join('\n');
    throw new Error(`Schema validation failed (strict):\n${summary}`);
  }

  return { issues, hasErrors };
}

/** issues 배열을 콘솔에 출력한다. */
export function printPropValidationResult(result: PropValidationResult): void {
  if (!result.hasErrors) {
    console.log('✅ Props schema validation passed — no issues found.');
    return;
  }

  console.warn(`⚠️  Props schema validation: ${result.issues.length} issue(s) found`);
  for (const issue of result.issues) {
    console.warn(`  ⚠️  scene ${issue.sceneId} [${issue.component}] .${issue.path}: ${issue.message}`);
  }
}
