# Lecture Automation Makefile

.PHONY: help install build run run-lambda run-force run-force-lambda regen-scene regen-scene-lambda regen-visual regen-visual-lambda run-tts-only run-tts-chunk apply-tts apply-tts-lambda apply-tts-chunk apply-tts-chunk-lambda list-chunks find-chunk run-render-only run-render-only-lambda render-scene render-scene-lambda record-webm concat-scenes clean preview preview-motion icon-coverage tts-sample \
        sync-playwright sync-preview sync-preview-gate save-auth validate-schema lint lint-fix audit deploy-lambda \
        tts-bootstrap-kokoro tts-bootstrap-xtts tts-bootstrap-gpt-sovits tts-bootstrap-fish-speech tts-check-uv

# 기본 변수 설정
LECTURE ?= lecture-01-01.json
CHUNK_SIZE ?= 2000
ENGINE_PATH = packages/automation/dist/presentation/cli/main.js
ENGINE_RENDER_SCENE = packages/automation/dist/presentation/cli/render-scene.js
ENGINE_RECORD_WEBM = packages/automation/dist/presentation/cli/record-webm.js
ENGINE_CONCAT_SCENES = packages/automation/dist/presentation/cli/concat-scenes.js
REMOTION_PATH = packages/remotion
OUTPUT_DIR = output
RUN_ENV_VARS = $(if $(strip $(MODEL)),MODEL="$(MODEL)")

# Lambda 씬 분할 크기 (단일 씬 재렌더 가속 시 CHUNK_SIZE=200 등으로 override)
# 기본 2000 — 다중 씬 동시 렌더에 최적 (이슈 #109). 작을수록 씬 내부 병렬성 ↑
export REMOTION_LAMBDA_FRAMES_PER_LAMBDA = $(CHUNK_SIZE)

help:
	@echo "🎓 Lecture Automation CLI"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "📦 설치 / 빌드"
	@echo "--------------------------------------------------"
	@echo "make install                          - 모든 패키지 의존성 설치"
	@echo "make install-align-deps               - 마스터 오디오 정렬용 Python 가상환경 생성"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "🎬 전체 파이프라인"
	@echo "--------------------------------------------------"
	@echo "make run                              - 전 공정 실행 (기본: lecture-01-01.json)"
	@echo "make run LECTURE=xxx                  - 특정 강의 JSON 으로 실행 (activeProvider TTS)"
	@echo "make run-lambda LECTURE=xxx           - run + 씬 클립을 Remotion Lambda 로 병렬 렌더링"
	@echo "make run-force                        - 기존 에셋 무시하고 전체 재생성"
	@echo "make run-force-lambda LECTURE=xxx     - Lambda + 강제 재생성"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "🔄 씬 단위 재생성 (TTS + 캡처 + 클립 모두)"
	@echo "--------------------------------------------------"
	@echo "make regen-scene LECTURE=xxx SCENE=5          - 특정 씬 빠르게 재생성 (TTS·webm·클립)"
	@echo "make regen-scene LECTURE=xxx SCENE='5 12'     - 여러 씬 동시 재생성"
	@echo "make regen-scene-lambda LECTURE=xxx SCENE='5 12' - regen-scene + Lambda"
	@echo "make regen-visual LECTURE=xxx SCENE='6 14'    - 씬 visual 만 재생성 (webm + 클립, TTS 유지)"
	@echo "make regen-visual LECTURE=xxx                - SCENE 미지정 시 mp4 누락 씬만 자동 탐지"
	@echo "make regen-visual-lambda LECTURE=xxx SCENE='6 14' - regen-visual + Lambda"
	@echo "make regen-visual-lambda LECTURE=xxx         - SCENE 미지정 시 mp4 누락 씬만 자동 탐지 + Lambda"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "🔊 TTS 재생성 (씬 단위)"
	@echo "--------------------------------------------------"
	@echo "make run-tts-only LECTURE=xxx SCENE='1 2 3'   - 지정 씬 TTS 만 재생성 + 미리 듣기 파일 생성"
	@echo "make apply-tts LECTURE=xxx SCENE='1 2 3'      - 기존 wav/webm 유지, 지정 씬 클립만 재렌더 & 병합"
	@echo "make apply-tts-lambda LECTURE=xxx SCENE='1 2 3' - apply-tts + Lambda"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "🧩 TTS 재생성 (청크 단위, 이슈 #113)"
	@echo "--------------------------------------------------"
	@echo "make apply-tts-chunk LECTURE=xxx SCENE=16 CHUNK='0 5 7'        - 특정 청크만 재생성 + 클립 재렌더"
	@echo "make apply-tts-chunk-lambda LECTURE=xxx SCENE=16 CHUNK='0 5 7' - apply-tts-chunk + Lambda"
	@echo "make run-tts-chunk LECTURE=xxx SCENE=16 CHUNK='0 5 7'          - 청크 재생성 + concat + 미리 듣기 (렌더 생략)"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "🔎 청크 탐색 도우미"
	@echo "--------------------------------------------------"
	@echo "make list-chunks LECTURE=xxx SCENE=16              - 씬 청크 목록 (인덱스·글자 범위·미리보기)"
	@echo "make find-chunk LECTURE=xxx SCENE=16 TEXT='...'    - 특정 문구가 속한 청크 검색 + 재생성 명령 제안"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "🎞️  렌더링 / 클립 조작"
	@echo "--------------------------------------------------"
	@echo "make run-render-only LECTURE=xxx              - TTS/캡처 생략, 전체 씬 렌더링 & 병합 재실행"
	@echo "make run-render-only-lambda LECTURE=xxx       - run-render-only + Lambda"
	@echo "make render-scene LECTURE=xxx SCENE=5         - 특정 씬 클립만 렌더링"
	@echo "make render-scene LECTURE=xxx SCENE='5 12'    - 여러 씬 클립 렌더링"
	@echo "make render-scene-lambda LECTURE=xxx SCENE='5 12' - Lambda 로 씬 클립 병렬 렌더링"
	@echo "  └─ CHUNK_SIZE=200 옵션 추가 시 단일 씬 내부를 더 잘게 분할 (기본 2000, 작을수록 씬 내부 병렬성 ↑)"
	@echo "make record-webm LECTURE=xxx SCENE=17         - 특정 Playwright 씬 webm 재생성"
	@echo "make record-webm LECTURE=xxx SCENE='17 18'    - 여러 Playwright 씬 webm 재생성"
	@echo "make concat-scenes LECTURE=xxx                - 씬 클립 이어붙여 최종 MP4 생성"
	@echo "make deploy-lambda                            - Remotion 사이트 번들 빌드 & S3 업로드 (public/ 변경 후)"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "🎨 프리뷰 / 샘플"
	@echo "--------------------------------------------------"
	@echo "make preview SCENE=6                             - 특정 씬 프리뷰 이미지 생성 (PNG)"
	@echo "make preview-motion LECTURE=xxx SCENE=6          - 특정 씬의 no-audio 모션 프리뷰 생성"
	@echo "make preview-motion LECTURE=xxx SCENE=6 DURATION=150 - 프리뷰 길이 지정"
	@echo "make tts-sample                                  - 현재 프로바이더로 TTS 샘플 생성"
	@echo "make tts-sample TTS=gemini_cloud_tts RATE=0.7    - 프로바이더/속도 지정"
	@echo "make icon-coverage                               - lecture JSON 의 icon 매핑 누락/오타 검사"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "🔗 싱크 / 인증"
	@echo "--------------------------------------------------"
	@echo "make sync-playwright LECTURE=xxx              - Playwright 씬 narration-action 싱크 자동 조정"
	@echo "make sync-playwright LECTURE=xxx SCENE=17     - 특정 씬만 싱크 조정"
	@echo "make sync-preview LECTURE=xxx                 - 녹화 전 sync 결과 시뮬레이션 (drift 사전 점검)"
	@echo "make sync-preview LECTURE=xxx SCENE=17        - 특정 씬만 시뮬레이션"
	@echo "                                                run / run-lambda 가 prerequisite 으로 자동 실행 (--gate)"
	@echo "make save-auth SERVICE=claude                 - 브라우저 인증 상태 저장 (Claude/ChatGPT 등)"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "🧹 검증 / Lint / Audit"
	@echo "--------------------------------------------------"
	@echo "make lint LECTURE=xxx                         - 강의 JSON lint 검사 (TTS 지뢰, 기호 위반 등)"
	@echo "make lint-fix LECTURE=xxx                     - lint + 자동 수정 가능 항목 적용"
	@echo "make audit LECTURE=xxx                        - TTS 오독 자동 감사 (Gemini 2.5 Flash STT 대조)"
	@echo "make audit LECTURE=xxx SCENE='5 31'           - 특정 씬만 감사"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "🧪 로컬 TTS PoC (Issue #151, CPU-only)"
	@echo "--------------------------------------------------"
	@echo "make tts-bootstrap-kokoro                     - Kokoro-82M venv + ONNX 모델 다운로드"
	@echo "make tts-bootstrap-xtts                       - XTTS-v2 venv (CPML 동의 필요)"
	@echo "make tts-bootstrap-gpt-sovits                 - GPT-SoVITS clone + venv (모델 수동 다운로드)"
	@echo "make tts-bootstrap-fish-speech                - Fish Speech clone + venv (FARL 동의 필요)"
	@echo ""
	@echo "--------------------------------------------------"
	@echo "🗑️  정리"
	@echo "--------------------------------------------------"
	@echo "make clean                                    - 생성된 모든 에셋 및 결과물 삭제"

install:
	@echo "📦 의존성 설치 중..."
	npm install

build:
	@echo "🔨 automation 패키지 빌드 중..."
	npm run build -w packages/automation

run: lint sync-preview-gate build
	@echo "🚀 강의 자동화 파이프라인 시작: $(LECTURE)"
	env $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

run-lambda: lint sync-preview-gate build
	@echo "☁️  Remotion Lambda 모드로 파이프라인 시작: $(LECTURE)"
	env REMOTION_RENDER_MODE=lambda $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

run-force: lint sync-preview-gate build
	@echo "🔄 강제 재생성 모드로 파이프라인 시작: $(LECTURE)"
	env FORCE=1 $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

run-force-lambda: lint sync-preview-gate build
	@echo "☁️🔄 Remotion Lambda + 강제 재생성 모드로 파이프라인 시작: $(LECTURE)"
	env FORCE=1 REMOTION_RENDER_MODE=lambda $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

regen-scene: build
	@echo "🔄 특정 Scene 재생성: $(LECTURE) / Scene $(SCENE)"
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.wav 삭제 중..."; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene.wav; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene.alignment.json; \
		echo "  🗑️  scene-$$scene chunk 캐시 삭제 중..."; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene-chunk-*.wav; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene-chunk-*.alignment.json; \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
		echo "  🗑️  scene-$$scene.webm 캡처 삭제 중..."; \
		rm -f packages/remotion/public/captures/$$LECTURE_ID/scene-$$scene.webm; \
		echo "  🗑️  session 캡처 디렉토리 삭제 중 (shared 씬)..."; \
		find packages/remotion/public/state-captures/$$LECTURE_ID -type d -name "scene-$$scene" -exec rm -rf {} + 2>/dev/null || true; \
	done
	env TARGET_SCENES="$(SCENE)" node $(ENGINE_PATH) $(LECTURE)

regen-scene-lambda: build
	@echo "🔄 특정 Scene 재생성 (Lambda): $(LECTURE) / Scene $(SCENE)"
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.wav 삭제 중..."; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene.wav; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene.alignment.json; \
		echo "  🗑️  scene-$$scene chunk 캐시 삭제 중..."; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene-chunk-*.wav; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene-chunk-*.alignment.json; \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
		echo "  🗑️  scene-$$scene.webm 캡처 삭제 중..."; \
		rm -f packages/remotion/public/captures/$$LECTURE_ID/scene-$$scene.webm; \
		echo "  🗑️  session 캡처 디렉토리 삭제 중 (shared 씬)..."; \
		find packages/remotion/public/state-captures/$$LECTURE_ID -type d -name "scene-$$scene" -exec rm -rf {} + 2>/dev/null || true; \
	done
	env TARGET_SCENES="$(SCENE)" REMOTION_RENDER_MODE=lambda node $(ENGINE_PATH) $(LECTURE)

regen-visual: build
	@echo "🎞️  Visual 씬만 재생성 (TTS 유지): $(LECTURE)"
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	if [ -z "$(SCENE)" ]; then \
		TARGET=$$(node -e "const fs=require('fs');const d=require('./data/$(LECTURE)');console.log(d.sequence.map(s=>s.scene_id).filter(id=>!fs.existsSync('$(OUTPUT_DIR)/clips/'+d.lecture_id+'/scene-'+id+'.mp4')).join(' '))"); \
		if [ -z "$$TARGET" ]; then \
			echo "✅ 모든 씬 클립 존재 — 재생성 대상 없음"; \
			exit 0; \
		fi; \
		echo "🔍 SCENE 미지정 — mp4 누락 씬 자동 탐지: $$TARGET"; \
	else \
		TARGET="$(SCENE)"; \
		echo "🎯 지정 씬: $$TARGET"; \
	fi; \
	for scene in $$TARGET; do \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
		echo "  🗑️  scene-$$scene.webm 캡처 삭제 중..."; \
		rm -f packages/remotion/public/captures/$$LECTURE_ID/scene-$$scene.webm; \
		echo "  🗑️  session 캡처 디렉토리 삭제 중 (shared 씬)..."; \
		find packages/remotion/public/state-captures/$$LECTURE_ID -type d -name "scene-$$scene" -exec rm -rf {} + 2>/dev/null || true; \
	done; \
	env TARGET_SCENES="$$TARGET" node $(ENGINE_PATH) $(LECTURE)

regen-visual-lambda: build
	@echo "🎞️☁️  Visual 씬만 재생성 (TTS 유지, Lambda): $(LECTURE)"
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	if [ -z "$(SCENE)" ]; then \
		TARGET=$$(node -e "const fs=require('fs');const d=require('./data/$(LECTURE)');console.log(d.sequence.map(s=>s.scene_id).filter(id=>!fs.existsSync('$(OUTPUT_DIR)/clips/'+d.lecture_id+'/scene-'+id+'.mp4')).join(' '))"); \
		if [ -z "$$TARGET" ]; then \
			echo "✅ 모든 씬 클립 존재 — 재생성 대상 없음"; \
			exit 0; \
		fi; \
		echo "🔍 SCENE 미지정 — mp4 누락 씬 자동 탐지: $$TARGET"; \
	else \
		TARGET="$(SCENE)"; \
		echo "🎯 지정 씬: $$TARGET"; \
	fi; \
	for scene in $$TARGET; do \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
		echo "  🗑️  scene-$$scene.webm 캡처 삭제 중..."; \
		rm -f packages/remotion/public/captures/$$LECTURE_ID/scene-$$scene.webm; \
		echo "  🗑️  session 캡처 디렉토리 삭제 중 (shared 씬)..."; \
		find packages/remotion/public/state-captures/$$LECTURE_ID -type d -name "scene-$$scene" -exec rm -rf {} + 2>/dev/null || true; \
	done; \
	env TARGET_SCENES="$$TARGET" REMOTION_RENDER_MODE=lambda node $(ENGINE_PATH) $(LECTURE)

run-tts-only: build
	@echo "🔊 TTS만 생성: $(LECTURE) / Scene $(SCENE)"
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.wav / 청크 삭제 중..."; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene.wav; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene.alignment.json; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene-chunk-*.wav; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene-chunk-*.alignment.json; \
	done
	env TTS_ONLY=1 TARGET_SCENES="$(SCENE)" $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

apply-tts: build
	@echo "🔁 기존 wav/webm 유지, 지정 씬 클립만 재렌더 & 병합: $(LECTURE) / Scene $(SCENE)"
	@if [ -z "$(SCENE)" ]; then \
		echo "❌ SCENE 값을 지정해 주세요. 예: make apply-tts LECTURE=lecture-02-01.json SCENE='10 12'"; \
		exit 1; \
	fi
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
	done
	env RENDER_ONLY=1 TARGET_SCENES="$(SCENE)" $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

apply-tts-lambda: build
	@echo "☁️🔁 기존 wav/webm 유지, 지정 씬 클립만 Lambda로 재렌더 & 병합: $(LECTURE) / Scene $(SCENE)"
	@if [ -z "$(SCENE)" ]; then \
		echo "❌ SCENE 값을 지정해 주세요. 예: make apply-tts-lambda LECTURE=lecture-02-01.json SCENE='10 12'"; \
		exit 1; \
	fi
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
	done
	env RENDER_ONLY=1 TARGET_SCENES="$(SCENE)" REMOTION_RENDER_MODE=lambda $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

# ---------------------------------------------------------------------------
# apply-tts-chunk (이슈 #113)
#
# 특정 씬의 특정 청크(scene-N-chunk-M.wav) 만 삭제·재생성한 뒤 나머지 청크는
# 기존 파일을 재사용해 scene-N.wav 를 concat. 클립(scene-N.mp4) 도 재렌더하여
# 병합까지 수행한다. 전체 씬 TTS 재생성의 1/N 비용으로 오독 1개를 고칠 수 있다.
# ---------------------------------------------------------------------------
apply-tts-chunk: build
	@echo "🧩 청크 단위 재생성 + 씬 concat + 클립 재렌더: $(LECTURE) / Scene $(SCENE) / Chunk $(CHUNK)"
	@if [ -z "$(SCENE)" ] || [ -z "$(CHUNK)" ]; then \
		echo "❌ SCENE 과 CHUNK 를 모두 지정해 주세요."; \
		echo "   예: make apply-tts-chunk LECTURE=lecture-02-01.json SCENE=16 CHUNK='0 5 7'"; \
		exit 1; \
	fi
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
	done
	@TARGET_CHUNKS_ARG="$$(node -e "const s='$(SCENE)'.trim().split(/\s+/); const c='$(CHUNK)'.trim().split(/\s+/).join(','); console.log(s.map(id => id + ':' + c).join(' '))")"; \
	echo "  TARGET_CHUNKS=$$TARGET_CHUNKS_ARG"; \
	env TARGET_SCENES="$(SCENE)" TARGET_CHUNKS="$$TARGET_CHUNKS_ARG" $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

apply-tts-chunk-lambda: build
	@echo "☁️🧩 청크 단위 재생성 + 씬 concat + Lambda 클립 재렌더: $(LECTURE) / Scene $(SCENE) / Chunk $(CHUNK)"
	@if [ -z "$(SCENE)" ] || [ -z "$(CHUNK)" ]; then \
		echo "❌ SCENE 과 CHUNK 를 모두 지정해 주세요."; \
		echo "   예: make apply-tts-chunk-lambda LECTURE=lecture-02-01.json SCENE=16 CHUNK='0 5 7'"; \
		exit 1; \
	fi
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
	done
	@TARGET_CHUNKS_ARG="$$(node -e "const s='$(SCENE)'.trim().split(/\s+/); const c='$(CHUNK)'.trim().split(/\s+/).join(','); console.log(s.map(id => id + ':' + c).join(' '))")"; \
	echo "  TARGET_CHUNKS=$$TARGET_CHUNKS_ARG"; \
	env TARGET_SCENES="$(SCENE)" TARGET_CHUNKS="$$TARGET_CHUNKS_ARG" REMOTION_RENDER_MODE=lambda $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

run-tts-chunk: build
	@echo "🧩 청크 단위 재생성 + 씬 concat + 미리 듣기 (렌더 생략): $(LECTURE) / Scene $(SCENE) / Chunk $(CHUNK)"
	@if [ -z "$(SCENE)" ] || [ -z "$(CHUNK)" ]; then \
		echo "❌ SCENE 과 CHUNK 를 모두 지정해 주세요."; \
		echo "   예: make run-tts-chunk LECTURE=lecture-02-01.json SCENE=16 CHUNK='0 5 7'"; \
		exit 1; \
	fi
	@TARGET_CHUNKS_ARG="$$(node -e "const s='$(SCENE)'.trim().split(/\s+/); const c='$(CHUNK)'.trim().split(/\s+/).join(','); console.log(s.map(id => id + ':' + c).join(' '))")"; \
	echo "  TARGET_CHUNKS=$$TARGET_CHUNKS_ARG"; \
	env TTS_ONLY=1 TARGET_SCENES="$(SCENE)" TARGET_CHUNKS="$$TARGET_CHUNKS_ARG" $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

# ---------------------------------------------------------------------------
# list-chunks / find-chunk (이슈 #113 보조)
#
# 어느 청크를 재생성해야 하는지 확인하는 도우미. TTS 파이프라인과 동일한
# SyncPointNarrationChunker 를 사용해 실제 캐시 단위와 정확히 일치한다.
# ---------------------------------------------------------------------------
list-chunks:
	@if [ -z "$(SCENE)" ]; then \
		echo "❌ SCENE 값을 지정해 주세요. 예: make list-chunks LECTURE=lecture-02-01.json SCENE=16"; \
		exit 1; \
	fi
	@npx tsx packages/automation/src/presentation/cli/list-chunks.ts $(LECTURE) $(SCENE) $(if $(PREVIEW),--preview $(PREVIEW),)

find-chunk:
	@if [ -z "$(SCENE)" ] || [ -z "$(TEXT)" ]; then \
		echo "❌ SCENE 과 TEXT 를 모두 지정해 주세요."; \
		echo "   예: make find-chunk LECTURE=lecture-02-01.json SCENE=16 TEXT='予期しない空白'"; \
		exit 1; \
	fi
	@npx tsx packages/automation/src/presentation/cli/list-chunks.ts $(LECTURE) $(SCENE) --find "$(TEXT)"

run-render-only: build
	@echo "🎞️ 사전 준비(TTS, 캡처) 건너뛰고 렌더링 & 병합 시퀀스 실행: $(LECTURE)"
	env RENDER_ONLY=1 $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

run-render-only-lambda: build
	@echo "☁️🎞️  Remotion Lambda 로 렌더링 & 병합 시퀀스 실행: $(LECTURE)"
	env RENDER_ONLY=1 REMOTION_RENDER_MODE=lambda $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

render-scene: build
	@echo "🎞️  씬 클립 렌더링: $(LECTURE) / Scene $(SCENE)"
	node $(ENGINE_RENDER_SCENE) $(LECTURE) $(SCENE)

render-scene-lambda: build
	@echo "☁️  Remotion Lambda 씬 클립 렌더링: $(LECTURE) / Scene $(SCENE)"
	env REMOTION_RENDER_MODE=lambda node $(ENGINE_RENDER_SCENE) $(LECTURE) $(SCENE)

deploy-lambda: build
	@echo "☁️  Remotion Lambda 사이트 배포 (번들 업로드)..."
	node packages/automation/dist/presentation/cli/deploy-lambda.js

record-webm: build
	@echo "🎥 Playwright 씬 webm 녹화: $(LECTURE) / Scene $(SCENE)"
	@if [ -z "$(SCENE)" ]; then \
		echo "❌ SCENE 값을 지정해 주세요. 예: make record-webm LECTURE=lecture-03.json SCENE='17 18'"; \
		exit 1; \
	fi
	node $(ENGINE_RECORD_WEBM) $(LECTURE) $(SCENE)

concat-scenes: build
	@echo "🔗 씬 클립 이어붙이기: $(LECTURE)"
	node $(ENGINE_CONCAT_SCENES) $(LECTURE)

preview:
	@echo "📸 컴포넌트 프리뷰 이미지 생성 중..."
	@echo "사용법: make preview SCENE=6"
	@echo "       make preview SCENE=6 FRAME=45"
	@node scripts/preview.mjs $(LECTURE) $(SCENE) $(FRAME)

preview-motion:
	@echo "🎞️ no-audio 모션 프리뷰 생성 중..."
	@echo "사용법: make preview-motion LECTURE=lecture-01-03.json SCENE=6"
	@echo "       make preview-motion LECTURE=lecture-01-03.json SCENE=6 DURATION=150"
	@node scripts/preview-motion.mjs $(LECTURE) $(SCENE) $(or $(DURATION),$(FRAME))

icon-coverage:
	@echo "🧭 icon coverage 검사 중..."
	@node scripts/icon-coverage-check.mjs

tts-sample:
	@echo "🎤 TTS 샘플 음성 생성 중..."
	npx tsx scripts/tts-sample.ts $(TTS) $(RATE)

sync-playwright:
	@echo "🎯 Playwright 씬 narration-action 싱크 조정: $(LECTURE)"
	@if [ -n "$(SCENE)" ]; then \
		echo "   대상 씬: $(SCENE)"; \
		npx tsx packages/automation/src/presentation/cli/sync-playwright.ts $(LECTURE) $(SCENE); \
	else \
		npx tsx packages/automation/src/presentation/cli/sync-playwright.ts $(LECTURE); \
	fi

sync-preview:
	@echo "🔍 Playwright 씬 sync 사전 시뮬레이션: $(LECTURE)"
	@if [ -n "$(SCENE)" ]; then \
		echo "   대상 씬: $(SCENE)"; \
		npx tsx packages/automation/src/presentation/cli/sync-preview.ts $(LECTURE) $(SCENE); \
	else \
		npx tsx packages/automation/src/presentation/cli/sync-preview.ts $(LECTURE); \
	fi

# #141 옵션 B: run / run-lambda 직전 sync-preview 게이트.
# Playwright 씬이 없는 강의는 sync-preview 가 자동으로 정상 종료한다.
# segment 경고 ≥ 1 또는 drift > 3s 의심 액션이 있으면 exit 1 로 차단.
sync-preview-gate:
	@if [ -z "$(LECTURE)" ]; then \
		echo "❌ LECTURE 값을 지정해 주세요."; exit 1; \
	fi
	@echo "🚦 sync-preview gate: $(LECTURE)"
	@npx tsx packages/automation/src/presentation/cli/sync-preview.ts $(LECTURE) --gate || \
		(echo ""; echo "⛔ sync-preview gate 차단 — syncPoint/액션을 조정 후 재시도하세요. 'make sync-preview LECTURE=$(LECTURE)' 로 상세 확인."; exit 1)

save-auth:
	@echo "🔐 브라우저 인증 상태 저장: $(SERVICE)"
	@if [ -z "$(SERVICE)" ]; then \
		echo "❌ SERVICE 값을 지정해 주세요. 예: make save-auth SERVICE=claude"; \
		exit 1; \
	fi
	npx tsx packages/automation/src/presentation/cli/save-auth.ts $(SERVICE)

validate-schema:
	@echo "🔍 Schema validation: $(LECTURE)"
	@if [ -z "$(LECTURE)" ]; then \
		echo "❌ LECTURE 값을 지정해 주세요. 예: make validate-schema LECTURE=lecture-01-03.json"; \
		exit 1; \
	fi
	npx tsx packages/automation/src/presentation/cli/validate-lecture-schema.ts $(LECTURE) $(if $(filter 1,$(STRICT)),--strict,)

lint:
	@echo "🧹 Lint: $(LECTURE)"
	@if [ -z "$(LECTURE)" ]; then \
		echo "❌ LECTURE 값을 지정해 주세요. 예: make lint LECTURE=lecture-01-04.json"; \
		exit 1; \
	fi
	@npx tsx packages/automation/src/presentation/cli/lint-lecture.ts $(LECTURE) $(if $(filter 1,$(STRICT)),--strict,) || \
		(echo ""; echo "⛔ lint 차단됨 — 자동 수정 가능 항목은 'make lint-fix LECTURE=$(LECTURE)' 로 처리하세요"; exit 1)

lint-fix:
	@echo "🧹 Lint --fix: $(LECTURE)"
	@if [ -z "$(LECTURE)" ]; then \
		echo "❌ LECTURE 값을 지정해 주세요. 예: make lint-fix LECTURE=lecture-01-04.json"; \
		exit 1; \
	fi
	npx tsx packages/automation/src/presentation/cli/lint-lecture.ts $(LECTURE) --fix $(if $(filter 1,$(STRICT)),--strict,)

audit:
	@echo "🎧 TTS Audit: $(LECTURE)"
	@if [ -z "$(LECTURE)" ]; then \
		echo "❌ LECTURE 값을 지정해 주세요. 예: make audit LECTURE=lecture-01-04.json"; \
		exit 1; \
	fi
	npx tsx packages/automation/src/presentation/cli/audit.ts $(LECTURE) $(if $(SCENE),--scene '$(SCENE)',)

clean:
	@echo "🧹 생성된 에셋 및 결과물 정리 중..."
	rm -rf packages/remotion/public/audio/*
	rm -rf packages/remotion/public/captures/*
	rm -rf packages/remotion/public/state-captures/*
	rm -rf packages/remotion/public/screenshots/*
	rm -rf $(OUTPUT_DIR)/clips
	rm -rf $(OUTPUT_DIR)/*.mp4
	@echo "✅ 정리가 완료되었습니다."

# ─────────────────────────────────────────────────────────────────────────
# 로컬 TTS PoC (Issue #151) — Intel Mac CPU-only 환경
# 각 엔진은 tools/tts/python/{engine}/ 에 격리된 venv 를 사용한다.
# ─────────────────────────────────────────────────────────────────────────

tts-check-uv:
	@if ! command -v uv >/dev/null 2>&1; then \
		echo "❌ uv 가 설치되어 있지 않습니다."; \
		echo "   설치: curl -LsSf https://astral.sh/uv/install.sh | sh"; \
		echo "   참고: https://docs.astral.sh/uv/getting-started/installation/"; \
		exit 1; \
	fi

tts-bootstrap-kokoro: tts-check-uv
	@echo "📦 Kokoro-82M 부트스트랩 (CPU-only)"
	cd tools/tts/python/kokoro && uv sync
	@mkdir -p tools/tts/python/kokoro/models
	@if [ ! -f tools/tts/python/kokoro/models/kokoro-v1.0.onnx ]; then \
		echo "⬇️  Kokoro 모델 다운로드..."; \
		curl -L --fail -o tools/tts/python/kokoro/models/kokoro-v1.0.onnx \
			https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx; \
	else \
		echo "✓ kokoro-v1.0.onnx 이미 존재"; \
	fi
	@if [ ! -f tools/tts/python/kokoro/models/voices-v1.0.bin ]; then \
		echo "⬇️  Kokoro 보이스 파일 다운로드..."; \
		curl -L --fail -o tools/tts/python/kokoro/models/voices-v1.0.bin \
			https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin; \
	else \
		echo "✓ voices-v1.0.bin 이미 존재"; \
	fi
	@UNIDIC_RC=$$(find tools/tts/python/kokoro/.venv -path '*/unidic/dicdir/mecabrc' 2>/dev/null | head -1); \
	if [ -z "$$UNIDIC_RC" ]; then \
		echo "📚 unidic 사전 다운로드 (misaki[ja] G2P 의존성, ~250MB)..."; \
		cd tools/tts/python/kokoro && .venv/bin/python -m unidic download; \
	else \
		echo "✓ unidic 사전 이미 존재"; \
	fi
	@echo "✅ Kokoro 부트스트랩 완료"
	@echo "   다음: config/tts.json 의 activeProvider 를 \"kokoro\" 로 변경 후"
	@echo "   make run-tts-only LECTURE=lecture-XX.json SCENE='1 2 3' 으로 검증"

tts-bootstrap-xtts: tts-check-uv
	@echo "📦 XTTS-v2 부트스트랩 (CPU-only)"
	@echo ""
	@echo "⚠️  라이선스 주의: XTTS-v2 는 Coqui Public Model License 하에 배포됩니다."
	@echo "    https://coqui.ai/cpml 에서 전문을 확인하고 본인의 사용 범위가 허용되는지"
	@echo "    직접 검토하세요. 모델 가중치는 첫 합성 시 자동 다운로드됩니다."
	@echo ""
	cd tools/tts/python/xtts && uv sync
	@mkdir -p tools/tts/python/xtts/models
	@if [ ! -f tools/tts/python/xtts/models/speaker.wav ]; then \
		echo ""; \
		echo "⚠️  voice cloning 참조 음성이 없습니다:"; \
		echo "    tools/tts/python/xtts/models/speaker.wav"; \
		echo "    본인 권리를 가진 6~30초 mono WAV 를 위 경로에 배치하세요."; \
		echo ""; \
	fi
	@echo "✅ XTTS-v2 부트스트랩 완료 (의존성)"
	@echo "   라이선스 동의: export COQUI_TOS_AGREED=1"
	@echo "   speaker.wav 배치 후 make run-tts-only 로 검증"

tts-bootstrap-gpt-sovits: tts-check-uv
	@echo "📦 GPT-SoVITS 부트스트랩 (CPU-only)"
	@echo ""
	@echo "⚠️  GPT-SoVITS 는 PyPI 안정 배포가 없어 git clone 방식으로 설치합니다."
	@echo "    사전학습 모델은 라이선스 확인 후 수동 다운로드가 필요합니다."
	@echo ""
	cd tools/tts/python/gpt-sovits && uv sync
	@mkdir -p tools/tts/python/gpt-sovits/models
	@if [ ! -d tools/tts/python/gpt-sovits/models/GPT-SoVITS ]; then \
		echo "⬇️  GPT-SoVITS 클론..."; \
		git clone --depth 1 https://github.com/RVC-Boss/GPT-SoVITS \
			tools/tts/python/gpt-sovits/models/GPT-SoVITS; \
	else \
		echo "✓ GPT-SoVITS 클론 이미 존재"; \
	fi
	@echo ""
	@echo "✅ GPT-SoVITS 클론 완료"
	@echo ""
	@echo "다음 수동 단계:"
	@echo "  1. 사전학습 모델 다운로드 (HuggingFace lj1995/GPT-SoVITS):"
	@echo "     tools/tts/python/gpt-sovits/models/GPT-SoVITS/GPT_SoVITS/pretrained_models/"
	@echo "  2. 참조 음성 (3~10초 mono WAV) 준비 + 전사 텍스트 작성"
	@echo "  3. config/tts.json 의 providers.gpt_sovits 경로 입력"
	@echo "  4. activeProvider 를 \"gpt_sovits\" 로 변경 후 make run-tts-only"

tts-bootstrap-fish-speech: tts-check-uv
	@echo "📦 Fish Speech 부트스트랩 (CPU-only)"
	@echo ""
	@echo "⚠️  라이선스 주의: Fish Audio Research License."
	@echo "    https://github.com/fishaudio/fish-speech/blob/main/LICENSE 에서"
	@echo "    사용 시점의 라이선스를 확인하세요. 모델 가중치는 별도 다운로드입니다."
	@echo ""
	cd tools/tts/python/fish-speech && uv sync
	@mkdir -p tools/tts/python/fish-speech/models
	@if [ ! -d tools/tts/python/fish-speech/models/fish-speech ]; then \
		echo "⬇️  fish-speech 클론..."; \
		git clone --depth 1 https://github.com/fishaudio/fish-speech \
			tools/tts/python/fish-speech/models/fish-speech; \
	else \
		echo "✓ fish-speech 클론 이미 존재"; \
	fi
	@echo "📌 fish-speech editable install 시도..."
	cd tools/tts/python/fish-speech && \
		uv pip install -e models/fish-speech || \
		echo "⚠️  editable install 실패 — fish-speech 의 setup 요구사항을 README 에서 확인하세요"
	@echo ""
	@echo "✅ Fish Speech 클론 완료"
	@echo ""
	@echo "다음 수동 단계:"
	@echo "  1. https://huggingface.co/fishaudio/fish-speech-1.5 에서 라이선스 동의 후 가중치 다운로드"
	@echo "  2. tools/tts/python/fish-speech/models/fish-speech/checkpoints/fish-speech-1.5/ 에 배치"
	@echo "  3. config/tts.json 의 providers.fish_speech.checkpointDir 경로 입력"
	@echo "  4. activeProvider 를 \"fish_speech\" 로 변경 후 make run-tts-only"
