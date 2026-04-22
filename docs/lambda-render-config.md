# Lambda 렌더링 설정 가이드

Remotion Lambda로 씬 클립을 병렬 렌더링할 때의 설정값 선정 근거와 운영 가이드.

---

## 핵심 설정값

`.env` 에서 관리. 변경 후 재시작 필요.

| 환경변수 | 권장값 | 기본값 | 설명 |
|---|---|---|---|
| `REMOTION_LAMBDA_FRAMES_PER_LAMBDA` | **2000** | 10000 | Lambda 1개가 처리할 최대 프레임 수 |
| `REMOTION_LAMBDA_CONCURRENCY` | 20 | 20 | 동시 실행 씬 수 |
| `REMOTION_LAMBDA_TAB_CONCURRENCY` | (미설정) | Remotion 기본 | Lambda 인스턴스당 브라우저 탭 수 |

---

## REMOTION_LAMBDA_FRAMES_PER_LAMBDA 선정 근거

### 씬 분포 분석 (925개 씬 기준)

| 항목 | 값 |
|---|---|
| 총 씬 수 | 925개 |
| durationSec 중앙값 | 39초 |
| durationSec 최대 | 620초 (lecture-04-01 씬 20, playwright) |
| 씬 타입 | remotion 896개 / playwright 29개 |

### 긴 씬 TOP 10

| 강의 | 씬 | 길이 | 프레임 수 | 타입 |
|---|---|---|---|---|
| lecture-04-01 | 씬 20 | 620s | 18,600 | playwright |
| lecture-02-01 | 씬 16 | 249s | 7,470 | playwright |
| lecture-04-01 | 씬 13 | 242s | 7,260 | playwright |
| lecture-04-01 | 씬 15 | 204s | 6,120 | playwright |
| lecture-04-01 | 씬 14 | 162s | 4,860 | playwright |
| lecture-01-04 | 씬 18 | 157s | 4,710 | playwright |
| lecture-02-06 | 씬 20 | 132s | 3,960 | remotion |
| lecture-01-04 | 씬 7 | 125s | 3,750 | playwright |
| lecture-03-02 | 씬 42 | 120s | 3,600 | remotion |
| lecture-04-01 | 씬 25 | 110s | 3,300 | remotion |

### framesPerLambda 값별 비교

| framesPerLambda | 1청크(분할 없음) 씬 비율 | 최대 청크 수 | 평가 |
|---|---|---|---|
| 500 | 67/925 (7%) | 38 | 과도한 분할, stitching 부담 |
| 1000 | 343/925 (37%) | 19 | 여전히 과도 |
| **2000** | **834/925 (90%)** | **10** | **권장** |
| 3000 | 911/925 (98%) | 7 | 긴 씬 효과 약함 |

### 2000을 권장하는 이유

- **일반 슬라이드 씬(90%)은 분할 없이** Lambda 1개로 처리 → 오버헤드·stitching 없음
- **620초짜리 최장 씬은 10청크** → 단일 Lambda 대비 ~10배 빠름 (900초 타임아웃 회피)
- **최대 청크 10개**로 stitching 부담도 현실적 수준
- Lambda 동시 실행 수는 한도(1000) 대비 여유 있음

---

## REMOTION_LAMBDA_CONCURRENCY

씬 클립을 동시에 몇 개 렌더링할지 제어. 기본값 20.

- 씬 수가 적은 단일 강의 재생성(`regen-scene`) 시에는 영향 없음
- 전체 파이프라인(`run-lambda`) 에서 씬이 많을 때 병목 완화
- AWS Lambda 동시 실행 할당량(기본 1000) 초과 시 줄임

```
REMOTION_LAMBDA_CONCURRENCY=20
```

---

## REMOTION_LAMBDA_TAB_CONCURRENCY

Lambda 인스턴스 1개 안에서 브라우저 탭을 몇 개 병렬로 열지 제어.
미설정 시 Remotion 기본값 적용.

- Playwright 씬(브라우저 녹화)은 탭 1개가 권장 → 기본값(미설정) 유지
- remotion 씬 전용으로만 렌더링하는 경우 2~4로 올려 처리량 증가 가능

```
# 필요 시에만 설정
REMOTION_LAMBDA_TAB_CONCURRENCY=2
```

---

## 관련 코드

설정값을 읽는 소스: `packages/automation/src/infrastructure/providers/remotion-lambda/LambdaRenderConfigReader.ts`

```typescript
framesPerLambda: this.readPositiveIntegerEnv('REMOTION_LAMBDA_FRAMES_PER_LAMBDA', 10000),
maxConcurrentScenes: this.readPositiveIntegerEnv('REMOTION_LAMBDA_CONCURRENCY', 20),
tabConcurrency: this.readOptionalPositiveIntegerEnv('REMOTION_LAMBDA_TAB_CONCURRENCY'),
```

---

## 관련 make 명령어

```bash
make run-lambda LECTURE=lecture-04-01.json          # 전체 파이프라인 + Lambda 병렬 렌더
make render-scene-lambda LECTURE=lecture-04-01.json SCENE='13 14 15'  # 특정 씬만 Lambda 렌더
make regen-scene LECTURE=lecture-02-01.json SCENE='16'               # 재생성 + concat
```
