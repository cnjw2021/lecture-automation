import { Lecture, RemotionVisual } from '../../domain/entities/Lecture';
import { validateSharedSessions } from '../../domain/policies/SharedSessionValidator';

export class ValidateLectureUseCase {
  // 현재 Remotion에 실제 구현되어 있는 컴포넌트 목록
  private readonly SUPPORTED_COMPONENTS = [
    'TitleScreen',
    'SummaryScreen',
    'MyCodeScene',
    'KeyPointScreen',
    'ComparisonScreen',
    'DiagramScreen',
    'ProgressScreen',
    'QuoteScreen',
    'StatScreen',
    'TimelineScreen',
    'FeatureGridScreen',
    'AgendaScreen',
    'CodeWalkthroughScreen',
    'BeforeAfterScreen',
    'BarChartScreen',
    'PieChartScreen',
    'BulletDetailScreen',
    'DefinitionScreen',
    'QnAScreen',
    'SectionBreakScreen',
    'EndScreen',
    'TwoColumnScreen',
    'ImagePlaceholderScreen',
    'CalloutScreen',
    'NumberedListScreen',
    'IconListScreen',
    'VennDiagramScreen',
    'HierarchyScreen',
    'BrowserMockScreen',
    'ImageScreen',
  ];

  execute(lecture: Lecture): void {
    console.log(`[검증] '${lecture.lecture_id}' 강의 데이터 무결성 검사 중...`);

    for (const scene of lecture.sequence) {
      if (scene.visual.type === 'remotion') {
        const visual = scene.visual as RemotionVisual;
        if (!this.SUPPORTED_COMPONENTS.includes(visual.component)) {
          console.error(`\n❌ [치명적 에러] Scene ${scene.scene_id}에서 존재하지 않는 컴포넌트를 참조함: "${visual.component}"`);
          console.error(`📍 허용된 컴포넌트 목록: ${this.SUPPORTED_COMPONENTS.join(', ')}`);
          console.error(`💡 해결책: 'packages/remotion/src/Root.tsx'에 해당 컴포넌트를 구현하거나, JSON 대본의 'component' 필드를 수정하세요.\n`);
          
          throw new Error(`Unsupported Remotion Component: ${visual.component}`);
        }
      }
    }

    console.log(`✅ 모든 컴포넌트 검증 완료.`);

    const sharedSessionViolations = validateSharedSessions(lecture);
    if (sharedSessionViolations.length > 0) {
      console.error(`\n❌ [치명적 에러] shared session 씬 제약 위반 ${sharedSessionViolations.length}건 발견:`);
      for (const v of sharedSessionViolations) {
        console.error(`  - [${v.rule}] ${v.message}`);
      }
      throw new Error(`Shared session 제약 위반 ${sharedSessionViolations.length}건`);
    }
    console.log(`✅ shared session 제약 검증 완료.`);
  }
}
