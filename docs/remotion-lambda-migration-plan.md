# 🎯 Remotion Lambda 도입 로드맵

현재 로컬에서 `child_process.exec`를 통해 브라우저를 띄워 렌더링하는 구조(`RemotionSceneClipRenderProvider.ts`)를 AWS 기반의 **분산 렌더링(Distributed Rendering)** 구조로 마이그레이션하기 위해 필요한 작업 단계들입니다.

---

## 🏗️ 전체 아키텍처 개요

### 핵심 설계 원칙: 씬 단위 병렬화

현재 40~50개 씬을 로컬에서 순차적으로 렌더링하는 구조를 **씬마다 Lambda 함수 1개를 동시에 호출**하는 구조로 전환한다. 전체 렌더링 시간은 "모든 씬의 합산" 에서 "가장 오래 걸리는 씬 1개의 시간"으로 단축된다.

```
[현재] scene-1 → scene-2 → scene-3 → ... → scene-50  (순차, 로컬)

[목표] scene-1  → Lambda ①  ┐
       scene-2  → Lambda ②  ├─→ Promise.all 완료 → 다운로드 → concat
       scene-3  → Lambda ③  │
       ...                   │
       scene-50 → Lambda ⑤⓪ ┘
```

도입이 완료되면 현재의 로컬 `npm run build` 스크립트는 삭제되고, 코드는 다음과 같은 흐름으로 작동하게 됩니다.

1. **Bundle & Deploy**: Remotion 소스 코드를 번들링하여 AWS S3에 업로드 (`deploySite()`). 코드가 바뀌지 않았다면 재사용.
2. **Assets Upload**: TTS(wav) + Playwright 녹화(webm) + 스크린샷 완료 후, 생성된 파일을 S3의 사이트 번들과 동일한 경로에 업로드한다. 이렇게 하면 Remotion 컴포지션 내 `staticFile()` 호출이 코드 수정 없이 S3 경로로 자동 해석된다.
3. **Parallel Invoke**: 렌더링이 필요한 씬 전체에 대해 `renderMediaOnLambda()`를 동시에 호출 (`Promise.all`). 씬 1개당 Lambda 함수 1개가 할당되며, Lambda 내부의 프레임 분산은 사용하지 않는다.
4. **Poll**: 각 Lambda의 진행 상황을 `getRenderProgress()`로 폴링하여 터미널에 표시.
5. **Download & Cleanup**: 모든 씬 렌더 완료 후 출력 파일을 로컬로 다운로드, S3 결과물 정리, concat 실행.

---

## 📋 도입 5단계 실행 계획

### Phase 1: AWS 인프라 세팅 (인프라/권한 설정)
가장 기본적인, 그리고 프로젝트 팀원들의 로컬 환경에서 가장 헷갈리기 쉬운 파트입니다.
1. AWS 계정에 접속하여 **IAM 사용자(User)** 생성
2. 아래 명령어로 Remotion이 요구하는 **최소 권한 정책 JSON**을 출력하여 해당 사용자에 부여
   ```bash
   npx remotion lambda policies print
   ```
   > `AdministratorAccess`는 과도한 권한이므로 사용하지 않는다.
3. CLI 환경에 AWS 자격 증명(Access Key / Secret Key) 등록 (`aws configure`)
4. AWS 콘솔에서 결제(Billing) 수단 등록 확인

### Phase 2: 스크립트 및 환경 구성 (의존성 패키지 설치)
현재 `automation` 패키지(실제 렌더 오케스트레이션을 담당하는 로직)에 Lambda 전용 모듈을 설치합니다.
```bash
# automation 패키지에 lambda 도구 및 S3 업로드 SDK 설치
npm install @remotion/lambda @aws-sdk/client-s3 --workspace packages/automation
```
> [!IMPORTANT]  
> `@remotion/lambda` 버전은 루트에 설치된 `remotion`, `@remotion/bundler`, `@remotion/player`, `@remotion/react` 등 **모든 `@remotion/*` 패키지와 100% 동일하게 일치**해야 합니다.

### Phase 3: Remotion 환경 배포 (초기화)
Remotion Lambda 초기화는 다음 3단계로 실행합니다. 각 단계의 출력값을 환경변수에 저장해 두어야 Phase 4에서 사용할 수 있습니다.

```bash
# 1. IAM 권한 검증 (권한 부족이면 여기서 조기 발견)
npx remotion lambda policies validate

# 2. Lambda 함수 배포 (렌더링 timeout을 충분히 확보)
#    출력되는 함수 이름을 REMOTION_LAMBDA_FUNCTION_NAME에 저장
npx remotion lambda functions deploy --memory=2048 --timeout=900 --region=us-east-1

# 3. 사이트(번들) S3 업로드
#    출력되는 serveUrl을 REMOTION_SERVE_URL에 저장
npx remotion lambda sites create --site-name=lecture-automation --region=us-east-1
```

> [!NOTE]  
> `--timeout=900`은 15분. 긴 씬 렌더링 시 기본값(180초)으로는 타임아웃이 발생할 수 있습니다.

**환경변수 설정** — 위 명령어 출력값을 `.env`에 기록합니다:
```env
AWS_REGION=us-east-1
REMOTION_LAMBDA_FUNCTION_NAME=remotion-render-xxxxxxxxxx
REMOTION_SERVE_URL=https://s3.amazonaws.com/remotionlambda-xxxx/sites/lecture-automation/index.html
```

### Phase 4: 코드 리팩토링 (`RemotionSceneClipRenderProvider.ts`)
기존 `RemotionSceneClipRenderProvider.ts` 코드의 핵심 `renderScene` 부분을 전면 교체해야 합니다.

#### [변경 전 로직] 로컬 렌더 (현재)
- 임시 props.json 파일을 쓴다.
- `child_process`로 `npm run build` CLI 명령어를 실행한다.

#### [변경 후 로직] Lambda 씬 단위 병렬 호출 (목표)
`deploySite()`, `renderMediaOnLambda()`, `getRenderProgress()` 는 모두 **`@remotion/lambda`** 에서 import합니다. (`@remotion/bundler`는 로컬 번들링 전용이며 여기서는 사용하지 않습니다.)

```typescript
import { deploySite, renderMediaOnLambda, getRenderProgress } from '@remotion/lambda';
```

처리 흐름:
1. **serveUrl 결정**: 환경변수 `REMOTION_SERVE_URL`을 읽어 재사용. 코드가 변경된 경우에만 `deploySite()`를 호출하여 새 serveUrl을 얻는다. (Phase 5 참조)
2. **Assets S3 업로드**: `renderMediaOnLambda()` 호출 전에, 해당 강의의 wav/webm/screenshots 파일을 AWS SDK(`@aws-sdk/client-s3`)로 S3에 업로드한다. 업로드 대상 경로는 `serveUrl`에서 버킷명과 prefix를 파싱하여 결정하며, 로컬의 `public/` 디렉토리 구조와 동일하게 맞춘다.
   ```
   로컬: packages/remotion/public/audio/01/scene-1.wav
   S3:   s3://remotionlambda-xxxx/sites/lecture-automation/audio/01/scene-1.wav
   ```
   이 구조를 유지하면 Remotion 컴포지션의 `staticFile('audio/01/scene-1.wav')` 호출이 **코드 수정 없이** Lambda 환경에서 올바른 S3 URL로 해석된다.
3. **씬 전체 동시 호출**: 렌더링이 필요한 씬 목록 전체에 대해 `renderMediaOnLambda()`를 `Promise.all`로 동시에 호출한다. 각 씬은 독립된 Lambda 함수 1개가 처리한다. `framesPerLambda`는 씬의 총 프레임 수 이상으로 설정하여 Lambda 내부의 추가 프레임 분산이 발생하지 않도록 한다.
4. **진행률 표시**: 각 호출에서 반환되는 `renderId`를 활용해 `getRenderProgress()`를 폴링하여 씬별 진행률을 터미널에 표시한다.
5. **다운로드 및 정리**: 모든 씬 완료 후 각 출력 URL에서 파일을 받아 지정된 로컬 `outPath`에 저장한다. 이후 S3에 남은 렌더 결과물과 업로드했던 assets를 삭제하여 스토리지 비용이 누적되지 않도록 한다.

### Phase 5: 최적화 및 롤아웃 워크플로우 구성
1. **serveUrl 재사용**: Remotion 소스 코드가 변경되지 않았다면 `deploySite()`를 매번 호출하지 않고, 이미 배포된 `REMOTION_SERVE_URL`을 그대로 사용한다. 코드 변경 감지는 번들 해시 또는 수동 플래그로 판단한다.
2. **Makefile 타겟 추가**: `make render-scene-lambda` 타겟을 구성하여 기존 로컬 렌더(`make render-scene`)와 A/B 테스트를 진행한다.
3. **동시 호출 수 상한 관리**: AWS Lambda 계정의 기본 동시 실행 한도는 1,000개다. 씬 50개 동시 호출은 한도 내에 충분히 수용되지만, 향후 여러 강의를 동시에 처리하는 경우를 대비해 `Promise.all` 대신 `p-limit` 등으로 동시 호출 수의 상한을 설정해 두는 것이 안전하다.

---

## 현재 구현된 실행 경로

로컬 렌더는 기존 `make render-scene` 경로로 유지하고, Lambda 렌더는 별도 모드로 선택한다.

```bash
make render-scene-lambda LECTURE=lecture-01-03.json SCENE='28 29'
```

전체 파이프라인에서 Lambda 렌더를 사용하려면 렌더 단계 실행 시 `REMOTION_RENDER_MODE=lambda`를 지정한다.

```bash
REMOTION_RENDER_MODE=lambda make run-render-only LECTURE=lecture-01-03.json
```

필수 환경변수:

```env
AWS_REGION=us-east-1
REMOTION_LAMBDA_FUNCTION_NAME=remotion-render-xxxxxxxxxx
REMOTION_SERVE_URL=https://s3.amazonaws.com/remotionlambda-xxxx/sites/lecture-automation/index.html
```

선택 환경변수:

```env
# REMOTION_SERVE_URL이 없거나 강제 재배포가 필요한 경우 사용
REMOTION_LAMBDA_DEPLOY=1
REMOTION_LAMBDA_BUCKET_NAME=remotionlambda-xxxx
REMOTION_LAMBDA_SITE_NAME=lecture-automation

# 여러 강의를 동시에 돌릴 때 씬 병렬 호출 수 제한
REMOTION_LAMBDA_CONCURRENCY=20

# 씬 내부 프레임 청크 분산 방지. 기본값 10000.
REMOTION_LAMBDA_FRAMES_PER_LAMBDA=10000

# 지정하지 않으면 Remotion 기본값 사용. 필요할 때만 Lambda 내부 탭 수 조정.
REMOTION_LAMBDA_TAB_CONCURRENCY=2

# 기본값은 private / 정리 활성화
REMOTION_LAMBDA_PRIVACY=private
REMOTION_LAMBDA_CLEANUP_ASSETS=1
REMOTION_LAMBDA_CLEANUP_RENDERS=1
```
