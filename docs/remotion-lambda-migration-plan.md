# 🎯 Remotion Lambda 도입 로드맵

현재 로컬에서 `child_process.exec`를 통해 브라우저를 띄워 렌더링하는 구조(`RemotionSceneClipRenderProvider.ts`)를 AWS 기반의 **분산 렌더링(Distributed Rendering)** 구조로 마이그레이션하기 위해 필요한 작업 단계들입니다.

---

## 🏗️ 전체 아키텍처 개요

도입이 완료되면 현재의 로컬 `npm run build` 스크립트는 삭제되고, 코드는 다음과 같은 흐름으로 작동하게 됩니다.

1. **Bundle & Deploy**: 현재 설계된 React(Remotion) 코드를 번들링하여 AWS S3 버킷에 업로드 (`deploySite()`)
2. **Invoke**: 해당 S3 URL과 렌더링할 Props(JSON)를 지정하여 AWS Lambda 함수 호출 (`renderMediaOnLambda()`)
3. **Poll Pipeline**: 클라이언트 코드가 AWS에 작업 진척도를 계속 묻고(Polling), AWS는 내부적으로 수십 대의 워커(Lambda)를 띄워 샷을 병렬 처리
4. **Download**: 최종 합체된 MP4/WebM 파일이 생성되면 완성본을 로컬로 다운로드, S3 객체 정리

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
# automation 패키지에 lambda 도구 설치
npm install @remotion/lambda --workspace packages/automation
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

#### [변경 후 로직] Lambda API (목표)
`deploySite()`, `renderMediaOnLambda()`, `getRenderProgress()` 는 모두 **`@remotion/lambda`** 에서 import합니다. (`@remotion/bundler`는 로컬 번들링 전용이며 여기서는 사용하지 않습니다.)

```typescript
import { deploySite, renderMediaOnLambda, getRenderProgress } from '@remotion/lambda';
```

처리 흐름:
1. **serveUrl 결정**: 환경변수 `REMOTION_SERVE_URL`을 읽어 재사용. 코드가 변경된 경우에만 `deploySite()`를 호출하여 새 serveUrl을 얻는다. (Phase 5 참조)
2. **렌더 호출**: `renderMediaOnLambda()` 실행. `functionName`은 환경변수 `REMOTION_LAMBDA_FUNCTION_NAME`에서 읽고, Props로 `lectureData`를 직접 주입한다.
3. **진행률 표시**: 반환되는 `renderId`를 활용해 주기적으로 `getRenderProgress()`를 호출하여 진행률(예: 100/300 프레임 완료)을 터미널에 표시한다.
4. **다운로드 및 정리**: 완료 후 AWS에서 반환하는 출력 URL로 파일을 받아 지정된 로컬 `outPath`에 저장한다. 이후 S3에 남은 렌더 결과물을 삭제하여 스토리지 비용이 누적되지 않도록 한다.

### Phase 5: 최적화 및 롤아웃 워크플로우 구성
1. **serveUrl 재사용**: 여러 씬(혹은 여러 강의)을 렌더링할 때 Remotion 소스 코드가 변경되지 않았다면 `deploySite()`를 매번 호출하지 않고, 이미 배포된 `REMOTION_SERVE_URL`을 그대로 사용한다. 코드 변경 감지는 번들 해시 또는 수동 플래그로 판단한다.
2. **Makefile 타겟 추가**: `make render-scene-lambda` 타겟을 구성하여 기존 로컬 렌더(`make render-scene`)와 A/B 테스트를 진행한다.
3. **concurrency 관리**: `renderMediaOnLambda()`의 `concurrencyPerLambda` 옵션을 조정하여 AWS Lambda 계정 기본 한도(동시 실행 1,000개)를 초과하지 않도록 제어한다.
