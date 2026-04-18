# Playwright AI 라이브 데모 자동화 — P-D(공유 브라우저 컨텍스트) 기준 설계안

이 문서는 AI 라이브 데모 자동화의 **실제 목표 아키텍처**를 P-D 기준으로 정리한다.
여기서 P-D는 `브라우저 컨텍스트를 씬 간에 공유`하는 방향을 뜻한다.

이 문서의 목적은 두 가지다.

1. 현재 브랜치의 `urlFromScene + 재진입 + 역방향 싱크` 접근을 **최종안으로 오해하지 않도록** 한다.
2. 실제로 자동화를 계속 밀어붙일 경우, **어떤 계층을 어떻게 바꿔야 하는지**를 구현 단위까지 명확히 한다.

관련 배경 문서:
- [docs/playwright-ai-live-demo-history.md](docs/playwright-ai-live-demo-history.md)

---

## 1. 결론 먼저

자동화를 최우선 목표로 둘 경우, 다음 3가지를 동시에 채택해야 한다.

1. **AI 라이브 데모 씬은 씬 단위가 아니라 세션 단위로 실행**한다.
2. **브라우저 컨텍스트는 세션 동안 닫지 않는다.**
3. **가변 대기(`wait_for_claude_ready`)는 화면에 보이는 클립 밖에서 처리**한다.

이 설계로 바꾸면 결과 확인 씬은 더 이상 `/chat/{uuid}`를 다시 열지 않는다.
따라서 현재 구조의 핵심 문제였던 아래 타임라인이 사라진다.

```text
scene 29 start
-> goto stale/new url
-> wait_for_claude_ready
-> click artifact
-> preview visible
```

대신 목표 타임라인은 다음이 된다.

```text
shared session start
-> scene 28 visible actions recorded
-> offscreen wait_for_claude_ready
-> artifact open/offscreen settle
-> scene 29 visible actions recorded
-> shared session end
```

즉, **결과 확인 씬은 "이미 결과가 준비된 상태"에서 시작**해야 한다.

---

## 2. 왜 현재 구조로는 안 되는가

현재 브랜치는 다음 가정을 깔고 있다.

- 씬 28에서 conversation URL만 확보한다.
- 씬 29에서 그 URL을 다시 열면 결과 확인을 이어갈 수 있다.
- 씬 29의 가변 지연은 역방향 싱크로 오디오에 무음을 넣어 흡수할 수 있다.

하지만 자동화 목표에서는 이 가정들이 모두 약하다.

### 2.1 재진입 시점이 이미 늦다

씬 29가 시작한 뒤에 `goto -> ready wait -> artifact open`을 하면,
씬 첫 구절이 "나왔네요" 류일 때 시작부 싱크를 구조적으로 맞출 수 없다.

### 2.2 역방향 싱크는 시작부 구조 문제를 해결하지 못한다

역방향 싱크는 특정 phrase 앞에 무음을 삽입할 뿐이다.
즉, 첫 화면 자체가 잘못 시작되면 "결과 확인 씬이 로딩으로 시작한다"는 사실은 바뀌지 않는다.

### 2.3 `recordVideo` 기반 raw webm은 공유 컨텍스트와 잘 맞지 않는다

현재 `PlaywrightVisualProvider.record()`는 씬마다 브라우저/컨텍스트를 열고 닫는다.
Playwright의 `recordVideo`도 컨텍스트 종료 시점에 결과물이 확정되는 구조라,
같은 컨텍스트를 유지한 채 씬별 raw webm을 깔끔하게 뽑기 어렵다.

따라서 P-D의 MVP는 **공유 컨텍스트 + 상태 합성형 캡처**를 기준으로 잡는 것이 현실적이다.

---

## 3. 목표 상태

### 3.1 런타임 불변 조건

P-D가 완성되면 AI 라이브 데모는 아래 조건을 만족해야 한다.

1. 하나의 라이브 데모 세션은 **하나의 browser/context/page 생명주기**를 가진다.
2. 같은 세션에 속한 Playwright 씬들은 **같은 page 인스턴스**를 계속 사용한다.
3. 중간에 Remotion 슬라이드가 끼어 있어도, 브라우저 세션은 **백그라운드에서 계속 진행**될 수 있다.
4. 결과 확인 씬의 첫 프레임은 **이미 응답 완료 또는 프리뷰 오픈 직후 상태**여야 한다.
5. `wait_for_claude_ready`는 **클립 길이를 결정하지 않는다.**

### 3.2 사용자 관점의 효과

- 씬 28: 프롬프트 입력, 송신
- 씬 28.5: Artifact 설명 슬라이드
- 씬 29: 이미 결과가 준비된 상태에서 바로 "보이네요"로 시작

즉, 수강생은 더 이상 scene 29 시작에서 로딩 화면을 보지 않는다.

---

## 4. 핵심 설계 원칙

### 4.1 비결정적 대기는 "오프카메라"로 밀어낸다

LLM 응답 시간은 제어할 수 없다.
그러므로 자동화 설계는 그 가변 시간을 **씬 내부에서 흡수하려고 하지 말고**, 아예 **씬 자산 생성 바깥**에서 처리해야 한다.

이 문서에서는 이를 `offscreen action`이라고 부른다.

예:
- `wait_for_claude_ready`
- artifact 패널 자동/수동 오픈 전 정착 대기
- URL 전이 안정화

이 액션들은 세션 안에서 실행되지만, **씬 길이 계산과 캡처 대상에서는 제외**된다.

### 4.2 결과 확인 씬은 재진입이 아니라 "이어받기"여야 한다

현재의 `urlFromScene`은 "이전 씬이 만든 URL을 다시 열기"다.
P-D에서는 이것이 아니라 **이전 씬이 사용 중이던 페이지 상태 자체를 이어받아야** 한다.

즉, 결과 확인 씬은:

- 새 `goto`를 하지 않고
- 같은 page에서
- 필요한 offscreen wait를 끝낸 뒤
- visible action만 캡처

하는 구조여야 한다.

### 4.3 라이브 데모는 raw webm보다 synth capture를 우선한다

P-D의 MVP에서는 라이브 데모 씬을 모두 **상태 합성형 캡처**로 통일하는 것을 권장한다.

이유:
- 공유 컨텍스트에서 씬별 자산을 분리하기 쉽다.
- offscreen action을 캡처에서 제외하기 쉽다.
- scene 시작 시점을 임의로 끊어 쓰기 쉽다.
- raw webm처럼 "컨텍스트 종료 전까지 파일이 확정되지 않음" 문제를 피할 수 있다.

raw webm은 후순위 최적화 항목이다.

---

## 5. JSON/도메인 모델 변경안

### 5.1 `PlaywrightVisual`에 세션 정보를 추가한다

최소 변경안:

```ts
interface PlaywrightSessionConfig {
  id: string;
  mode: 'isolated' | 'shared';
}

interface PlaywrightVisual {
  type: 'playwright';
  action: PlaywrightAction[];
  syncPoints?: PlaywrightSyncPoint[];
  storageState?: string;
  session?: PlaywrightSessionConfig;
}
```

의미:
- `isolated`: 기존과 동일. 씬별 독립 실행
- `shared`: 같은 `session.id`를 가진 인접/연관 씬과 브라우저 컨텍스트 공유

### 5.2 action에 `offscreen` 플래그를 추가한다

```ts
interface PlaywrightAction {
  cmd: PlaywrightCmd;
  offscreen?: boolean;
  ...
}
```

의미:
- `offscreen: true`인 액션은 실제 세션에서 실행되지만,
  - 씬 캡처 step에는 포함하지 않고
  - 씬 길이 계산에도 포함하지 않는다

대표 사용처:
- `wait_for_claude_ready`
- 세션 재개 직후 DOM 정착 wait
- artifact 열기 전 준비 동작

### 5.3 `urlFromScene`은 shared session 씬에서 금지한다

`session.mode === 'shared'`인 씬에서는 다음 조합을 금지한다.

- `goto + urlFromScene`
- shared session 결과 확인 씬의 첫 action으로 `goto`

shared session은 URL 재참조가 아니라 **page 인스턴스 재사용**이기 때문이다.

### 5.4 결과 확인 씬의 첫 visible action 이전에 offscreen 구간을 둘 수 있어야 한다

예시:

```json
{
  "scene_id": 29,
  "narration": "出てきましたね。右側にプレビューが表示されています。...",
  "visual": {
    "type": "playwright",
    "storageState": "config/auth/claude.json",
    "session": { "id": "claude-salon-demo", "mode": "shared" },
    "syncPoints": [
      { "actionIndex": 3, "phrase": "スクロールしていくと" }
    ],
    "action": [
      { "cmd": "wait_for_claude_ready", "timeout": 180000, "offscreen": true },
      { "cmd": "wait", "ms": 1000, "offscreen": true },
      { "cmd": "click", "selector": "..." },
      { "cmd": "wait", "ms": 1200 },
      { "cmd": "scroll", "deltaY": 300 },
      { "cmd": "wait", "ms": 5000 }
    ]
  }
}
```

주의:
- 위 예시는 `click`이 visible action으로 남아 있다.
- 더 공격적으로 가려면 artifact open 자체도 offscreen으로 돌리고,
  scene 29는 첫 프레임부터 preview open 상태에서 시작하게 만들 수 있다.
- 어떤 쪽이든 핵심은 **첫 내레이션 전에 필요한 가변 지연을 클립 밖으로 빼는 것**이다.

---

## 6. 런타임 아키텍처

### 6.1 새 개념: `LiveDemoSession`

도메인 상으로는 "씬"보다 상위의 실행 단위가 필요하다.

```ts
interface LiveDemoSessionPlan {
  lectureId: string;
  sessionId: string;
  storageState?: string;
  sceneIds: number[];
}
```

이 plan은 lecture sequence를 훑으며 자동 생성한다.

규칙:
- `visual.type === 'playwright'`
- `visual.session?.mode === 'shared'`
- 같은 `session.id`

를 만족하는 scene들을 하나의 세션으로 묶는다.

### 6.2 새 Provider: `ISharedVisualSessionProvider`

권장 인터페이스:

```ts
interface SharedVisualSessionHandle {
  sessionId: string;
}

interface ISharedVisualSessionProvider {
  open(plan: LiveDemoSessionPlan): Promise<SharedVisualSessionHandle>;
  captureScene(handle: SharedVisualSessionHandle, scene: Scene, outputDir: string): Promise<void>;
  close(handle: SharedVisualSessionHandle): Promise<void>;
}
```

핵심 차이:
- 기존 `IVisualProvider.record(scene)`는 씬 단위
- 새 provider는 **세션을 먼저 열고**, 그 안에서 씬을 여러 개 캡처

### 6.3 P-D의 MVP는 `SharedStateCaptureProvider`로 간다

새 provider는 기존 `PlaywrightStateCaptureProvider`의 발상을 확장한다.

필요 기능:
- browser/context/page를 세션 동안 유지
- action 실행 전후 스크린샷/좌표/노트 저장
- `offscreen: true` action은 실행만 하고 manifest step으로 저장하지 않음
- scene별 manifest를 별도 디렉토리에 저장

즉, 구현 방향은:

- 기존 `PlaywrightStateCaptureProvider.capture(scene, outputDir)`를 대체하지 말고
- `SharedPlaywrightStateCaptureProvider`
  - `openSession()`
  - `captureSceneInSession()`
  - `closeSession()`

형태로 분리하는 편이 안전하다.

### 6.4 session manifest는 scene manifest와 별도로 둔다

권장 저장 예:

```text
packages/remotion/public/state-captures/01-03/
  session-claude-salon-demo/
    session.manifest.json
    scene-28/
      manifest.json
      step-0.png
      ...
    scene-29/
      manifest.json
      step-0.png
      ...
```

`session.manifest.json` 최소 필드:

```ts
interface LiveDemoSessionManifest {
  lectureId: string;
  sessionId: string;
  sceneIds: number[];
  startedAt: string;
  completedAt: string;
  traces?: string[];
}
```

scene별 manifest는 기존 `SceneManifest`를 최대한 재사용한다.

---

## 7. 파이프라인 변경안

P-D에서는 현재의 Stage 0/1.7a 구조를 유지할 이유가 줄어든다.

### 7.1 목표 파이프라인

```text
1) TTS 생성
1.5) 오디오 미리듣기 머지
1.7) Playwright 씬 순방향 싱크
2) 스크린샷 캡처
3) 시각 자료 캡처
   3a) shared live demo session 실행 + synth capture
   3b) isolated playwright scene 캡처
4) 씬 클립 렌더링
5) concat
```

### 7.2 왜 Stage 0 사전 녹화가 필요 없어지는가

현재 Stage 0은 "가변 녹화 길이" 때문에 존재한다.

하지만 P-D에서는:
- 가변 대기가 offscreen으로 빠지고
- scene 자산은 deterministic visible action만 포함하며
- 결과 확인 씬도 로딩이 아니라 준비 완료 상태에서 시작한다

따라서 TTS보다 먼저 raw video를 떠서 오디오를 거기에 맞출 필요가 없다.

### 7.3 왜 역방향 싱크를 없애는가

P-D의 목표는 "가변 시간을 오디오에 맞춘다"가 아니다.
P-D의 목표는 **가변 시간을 영상 클립의 바깥으로 밀어낸다**이다.

즉, shared session 씬에서는 `ReverseSyncPlaywrightUseCase` 자체가 핵심 경로에서 빠져야 한다.

정리:
- `isolated + wait_for`: 과거 호환을 위해 남길 수 있음
- `shared`: 역방향 싱크 금지, offscreen wait + 순방향 싱크만 사용

---

## 8. 구현 시 실제 수정 대상

### 8.1 도메인

- `packages/automation/src/domain/entities/Lecture.ts`
  - `session`
  - `offscreen`
  - shared session validation 규칙 추가

### 8.2 Use case

- `RunAutomationPipelineUseCase.ts`
  - Stage 0 / reverse sync 의존 제거 또는 shared/isolated 분기
- `RecordVisualUseCase.ts`
  - scene 단위 loop 외에 shared session plan 실행 경로 추가
- 새 use case 권장:
  - `PlanLiveDemoSessionsUseCase`
  - `CaptureSharedLiveDemoSessionsUseCase`

### 8.3 Provider

- 새 provider 추가:
  - `SharedPlaywrightStateCaptureProvider.ts`
- 기존 `PlaywrightVisualProvider.ts`
  - shared session 경로에서는 사용하지 않음
  - isolated 전용으로 축소 가능

### 8.4 Repository / 경로

- `FileLectureRepository.ts`
  - session capture 경로 helper 추가 고려
- `StepManifest.ts`
  - offscreen/visible step 구분 메타데이터가 필요하면 필드 확장

### 8.5 Remotion

- `PlaywrightSynthScene.tsx`
  - 현재 manifest 구조를 계속 쓸 수 있으면 변경 최소
  - 필요 시 scene 시작 전 fade-in, cursor hold 같은 연출 보강

---

## 9. lecture-01-03 마이그레이션 예시

### 9.1 scene 28

남겨야 할 것:
- `goto claude.ai/new`
- prompt type
- `press Enter`

없애야 할 것:
- URL 전달을 위한 `urlFromScene` 의존 설계

추가해야 할 것:
- `session: { id: "claude-salon-demo", mode: "shared" }`

### 9.2 scene 28.5

Remotion 슬라이드 그대로 유지.
단, 이제 이 슬라이드는 "실시간 응답 대기를 흡수하는 장치"가 아니라
**결과 확인 씬으로 자연스럽게 넘어가기 위한 서사적 브리지**가 된다.

### 9.3 scene 29

바꿔야 할 것:
- `goto urlFromScene`
- visible timeline 안의 `wait_for_claude_ready`

대신:
- shared session page를 그대로 사용
- 필요한 준비 동작은 `offscreen: true`
- visible action은 preview 확인 이후만 남김

결과:
- `"出てきましたね"`로 시작하는 나레이션을 유지할 수 있다
- 단, 첫 프레임이 정말 preview visible 상태인지 session runner가 보장해야 한다

---

## 10. 단계별 구현 순서

### Phase 1. 스키마와 판정 로직 정리

목표:
- `session.mode`
- `session.id`
- `offscreen`

를 도입하고,
- shared session scene
- isolated scene

을 명확히 구분한다.

이 단계에서 반드시 할 일:
- `isLiveDemoScene()` 류의 판정 로직을 한 곳으로 모은다.

### Phase 2. shared state capture MVP

목표:
- 브라우저 하나를 열고
- scene 28, 29를 같은 page로 처리하고
- scene별 state manifest를 저장

이 단계에서는 raw webm을 포기해도 된다.
핵심은 **start-of-scene sync가 깨지지 않는 첫 성공 사례**를 만드는 것이다.

### Phase 3. pipeline 전환

목표:
- shared session scene은 reverse sync 경로에서 완전히 제외
- Stage 0 의존 제거
- forward sync -> shared capture 순서 정리

### Phase 4. lecture-01-03 검증

성공 기준:
- scene 29 첫 프레임이 preview visible 상태
- `"出てきましたね"`가 억지 무음 없이 자연스럽게 시작
- rerun 시 stale URL 문제 재발 없음

### Phase 5. 다른 강의로 확장

적용 대상:
- `lecture-02-07`
- `lecture-03-07`
- `lecture-04-01`
- `lecture-04-03`

이 단계부터는 "라이브 데모 씬 설계 규칙"을 `docs/json-conversion-rules.md`에 반영해야 한다.

---

## 11. 남는 리스크

P-D로 가도 아래 문제는 남는다.

### 11.1 셀렉터 fragility

Claude UI 셀렉터는 여전히 깨질 수 있다.
다만 이 문제는 더 이상 sync 문제와 얽히지 않는다.
즉, 실패하면 "캡처 실패"로 좁혀진다.

### 11.2 세션 장기 유지

세션이 길어지면:
- 로그인 만료
- 탭 크래시
- Cloudflare 재검증

같은 런타임 문제가 생길 수 있다.

따라서 shared session provider는 다음을 기본 지원해야 한다.
- trace 저장
- scene 단위 로그
- 세션 타임아웃
- 실패 시 sessionId 기준 재실행

### 11.3 캡처 시간 자체는 여전히 길 수 있다

P-D는 final clip sync를 안정화할 뿐,
LLM 응답을 더 빠르게 만들지는 못한다.

즉, 자동화 파이프라인의 **실행 시간**은 길 수 있다.
하지만 중요한 차이는, 이제 그 긴 시간이 **결과물 싱크를 깨뜨리지 않는다**는 점이다.

---

## 12. 최종 권고

자동화를 최우선으로 둘 경우, 이 프로젝트는 아래 방향으로 정리하는 것이 맞다.

1. `urlFromScene + 역방향 싱크`를 라이브 데모의 최종 해법으로 취급하지 않는다.
2. shared session을 정식 개념으로 도입한다.
3. 라이브 데모의 MVP는 raw webm이 아니라 **shared synth capture**로 만든다.
4. `wait_for_claude_ready`는 visible scene 길이에서 제거한다.
5. 결과 확인 씬은 "다시 열기"가 아니라 "이어서 보여주기"로 설계한다.

한 줄로 요약하면:

**P-D의 본질은 "응답 대기 시간을 맞추는 것"이 아니라, "응답 대기 시간을 씬 바깥으로 추방하는 것"이다.**
