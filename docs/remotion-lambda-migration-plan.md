# 🎯 Remotion Lambda 도입 로드맵

현재 로컬에서 `child_process.exec`를 통해 브라우저를 띄워 렌더링하는 구조(`RemotionSceneClipRenderProvider.ts`)를 AWS 기반의 **분산 렌더링(Distributed Rendering)** 구조로 마이그레이션하기 위해 필요한 작업 단계들입니다.

---

## 🏗️ 전체 아키텍처 개요

도입이 완료되면 현재의 로컬 `npm run build` 스크립트는 삭제되고, 코드는 다음과 같은 흐름으로 작동하게 됩니다.

1. **Bundle & Deploy**: 현재 설계된 React(Remotion) 코드를 번들링하여 AWS S3 버킷에 업로드 (`deploySite()`)
2. **Invoke**: 해당 S3 URL과 렌더링할 Props(JSON)를 지정하여 AWS Lambda 함수 호출 (`renderMediaOnLambda()`)
3. **Poll Pipeline**: 클라이언트 코드가 AWS에 작업 진척도를 계속 묻고(Polling), AWS는 내부적으로 수십 대의 워커(Lambda)를 띄워 샷을 병렬 처리
4. **Download**: 최종 합체된 MP4/WebM 파일이 생성되면 완성본을 로컬로 다시 다운로드, 캐시 삭제

---

## 📋 도입 5단계 실행 계획

### Phase 1: AWS 인프라 세팅 (인프라/권한 설정)
가장 기본적인, 그리고 프로젝트 팀원들의 로컬 환경에서 가장 헷갈리기 쉬운 파트입니다.
1. AWS 계정에 접속하여 **IAM 사용자(User)** 생성 및 `AdministratorAccess` 혹은 최소 필수 권한 부여
2. CLI 환경에 AWS 자격 증명(Access Key / Secret Key) 등록 (`aws configure`)
3. AWS 콘솔에서 결제(Billing) 수단 등록 확인

### Phase 2: 스크립트 및 환경 구성 (의존성 패키지 설치)
현재 `automation` 패키지(실제 렌더 오케스트레이션을 담당하는 로직)에 Lambda 전용 모듈을 설치합니다.
```bash
# automation 패키지에 lambda 도구 설치
npm install @remotion/lambda --workspace packages/automation
```
> [!IMPORTANT]  
> `@remotion/lambda` 버전은 루트에 설치된 `remotion` 버전과 **반드시 100% 동일하게 일치**해야 합니다.

### Phase 3: Remotion 환경 배포 (초기화)
AWS 콘솔을 직접 조작할 필요 없이 단 한 줄의 명령어로 서버리스 리소스들(S3 Bucket, 함수, Role 등)이 자동으로 셋업됩니다.
```bash
# 기본 2048MB 램을 가진 Lambda 워커들을 생성하고 필수 권한 등을 설정
npx remotion lambda setup --region=us-east-1
```

### Phase 4: 코드 리팩토링 (`RemotionSceneClipRenderProvider.ts`)
기존 `RemotionSceneClipRenderProvider.ts` 코드의 핵심 `renderScene` 부분을 전면 교체해야 합니다. 

#### [변경 전 로직] 로컬 렌더 (현재)
- 임시 props.json 파일을 쓴다.
- `child_process`로 `npm run build` CLI 명령어를 실행한다.

#### [변경 후 로직] Lambda API (목표)
- `@remotion/bundler` 모듈을 사용해서 코드를 AWS에 푸시하거나, 기존에 Deploy된 siteId를 얻는다. (`deploySite`)
- `@remotion/lambda` 패키지의 `renderMediaOnLambda()` 함수 실행. 이때 Props로 `lectureData`를 직접 주입.
- 이후 반환되는 `renderId`를 활용해 주기적으로 `getRenderProgress()` 함수를 호출, 진행률(100/300 프레임 렌더 완료 등)을 터미널 콘솔에 표시
- 완료되면 AWS에서 반환해 주는 URL에서 파일을 받아와 지정된 로컬 `outPath`에 쓴 뒤 `Promise.resolve()` 처리.

### Phase 5: 최적화 및 롤아웃 워크플로우 구성
1. 여러 개의 씬(혹은 여러 강의)을 렌더링할 때 Site 코드가 변경되지 않았다면 `deploySite`를 매번 하지 않고(비용과 시간 소모), 이미 배포된 **Serve URL을 재사용**하는 로직 구축
2. `Makefile` 내에 Lambda 전용 렌더 타겟(`make render-scene-lambda`)을 구성하여 기존 방식과 A/B 테스트 진행.
