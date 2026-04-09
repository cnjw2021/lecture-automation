# Lecture Automation Makefile

.PHONY: help install install-align-deps build run run-master run-force run-master-force regen-scene render-scene record-webm align-master-audio import-master-audio import-master-audio-auto concat-scenes clean render-only preview tts-sample \
        preview-browser-mock preview-screenshot capture-screenshots test-screenshot-options \
        preview-springs sync-playwright save-auth

# 기본 변수 설정
LECTURE ?= p1-01-01.json
SAMPLE_LECTURE ?= sample-screenshot-test.json
ENGINE_PATH = packages/automation/dist/presentation/cli/main.js
ENGINE_RENDER_SCENE = packages/automation/dist/presentation/cli/render-scene.js
ENGINE_RECORD_WEBM = packages/automation/dist/presentation/cli/record-webm.js
ENGINE_ALIGN_MASTER_AUDIO = packages/automation/dist/presentation/cli/align-master-audio.js
ENGINE_IMPORT_MASTER_AUDIO = packages/automation/dist/presentation/cli/import-master-audio.js
ENGINE_CONCAT_SCENES = packages/automation/dist/presentation/cli/concat-scenes.js
REMOTION_PATH = packages/remotion
OUTPUT_DIR = output
RUN_ENV_VARS = $(if $(strip $(MASTER_AUDIO)),MASTER_AUDIO="$(MASTER_AUDIO)") \
               $(if $(strip $(NARRATION_SOURCE)),NARRATION_SOURCE="$(NARRATION_SOURCE)") \
               $(if $(strip $(MASTER_ALIGNMENT)),MASTER_ALIGNMENT="$(MASTER_ALIGNMENT)") \
               $(if $(strip $(ALIGN)),ALIGN="$(ALIGN)") \
               $(if $(strip $(ALIGN_MODEL)),ALIGN_MODEL="$(ALIGN_MODEL)") \
               $(if $(strip $(MODEL)),MODEL="$(MODEL)")

help:
	@echo "🎓 Lecture Automation CLI"
	@echo "--------------------------------------------------"
	@echo "make install         - 모든 패키지 의존성 설치"
	@echo "make install-align-deps - 마스터 오디오 정렬용 Python 가상환경 생성"
	@echo "make run             - 전 공정 실행 (기본: p1-01-01.json)"
	@echo "make run LECTURE=xxx - 특정 강의 JSON 파일로 실행"
	@echo "                       config/tts.json의 activeProvider로 씬별 TTS 생성"
	@echo "make run-master LECTURE=xxx - master.wav 재사용 또는 config/tts.json의 masterAudio로 생성 후 정렬/분할"
	@echo "make run-force       - 기존 에셋 무시하고 전체 재생성 (기본: activeProvider TTS)"
	@echo "make run-master-force LECTURE=xxx - master audio를 강제로 재생성 후 정렬/분할"
	@echo "make run-synth       - 상태 합성형 모드로 실행 (스크린샷 기반)"
	@echo "make clean           - 생성된 모든 에셋 및 결과물 삭제"
	@echo "make render-only     - 에셋이 있을 때 Remotion 렌더링만 실행"
	@echo "make preview SCENE=6 - 특정 씬의 프리뷰 이미지 생성 (PNG)"
	@echo "make tts-sample      - 현재 프로바이더로 TTS 샘플 생성"
	@echo "make tts-sample TTS=gemini_cloud_tts RATE=0.7 - 프로바이더/속도 지정"
	@echo "make regen-scene LECTURE=xxx SCENE=5       - 특정 씬 오디오만 재생성"
	@echo "make regen-scene LECTURE=xxx SCENE='5 12'  - 여러 씬 동시 재생성"
	@echo "make render-scene LECTURE=xxx SCENE=5      - 특정 씬 클립만 렌더링"
	@echo "make render-scene LECTURE=xxx SCENE='5 12' - 여러 씬 클립 렌더링"
	@echo "make record-webm LECTURE=xxx SCENE=17      - 특정 Playwright 씬 webm 재생성"
	@echo "make record-webm LECTURE=xxx SCENE='17 18' - 여러 Playwright 씬 webm 재생성"
	@echo "make align-master-audio LECTURE=xxx AUDIO=... [MODEL=small] - master.wav에서 alignment.json 생성"
	@echo "make import-master-audio LECTURE=xxx AUDIO=... ALIGN=... - 강의 단위 TTS를 씬별 WAV로 분할"
	@echo "make import-master-audio-auto LECTURE=xxx AUDIO=... [MODEL=small] - alignment 생성 후 씬별 WAV 분할"
	@echo "make concat-scenes LECTURE=xxx             - 씬 클립 이어붙여 최종 MP4 생성"
	@echo "make sync-playwright LECTURE=xxx           - Playwright 씬 narration-action 싱크 자동 조정"
	@echo "make sync-playwright LECTURE=xxx SCENE=17  - 특정 씬만 싱크 조정"
	@echo "make save-auth SERVICE=claude             - 브라우저 인증 상태 저장 (Claude/ChatGPT 등)"
	@echo ""
	@echo "--- 스크린샷 옵션 테스트 ---"
	@echo "make preview-browser-mock                       - [옵션B] BrowserMockScreen 프리뷰 (PNG)"
	@echo "make capture-screenshots                        - [옵션A] Playwright 스크린샷 캡처만 실행"
	@echo "make capture-screenshots LECTURE=my-lecture.json"
	@echo "make preview-screenshot                         - [옵션A] 캡처 이미지로 ImageScreen 프리뷰 (PNG)"
	@echo "make test-screenshot-options                    - [옵션A+B] 캡처 → 두 옵션 프리뷰 한번에 실행"
	@echo "make preview-springs                            - 스프링 프리셋 5종 × 3프레임 비교 PNG 생성"
	@echo "--------------------------------------------------"

install:
	@echo "📦 의존성 설치 중..."
	npm install

install-align-deps:
	@echo "🐍 정렬용 Python 가상환경 생성 중..."
	python3 -m venv .venv-align
	.venv-align/bin/pip install --upgrade pip
	.venv-align/bin/pip install -r scripts/requirements-align.txt

build:
	@echo "🔨 automation 패키지 빌드 중..."
	npm run build -w packages/automation

run:
	@echo "🚀 강의 자동화 파이프라인 시작: $(LECTURE)"
	env $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

run-master:
	@echo "🎙️ 마스터 오디오 기반 파이프라인 시작: $(LECTURE)"
	env $(RUN_ENV_VARS) NARRATION_SOURCE=master node $(ENGINE_PATH) $(LECTURE)

run-synth:
	@echo "🖼️ 상태 합성형 모드로 파이프라인 시작: $(LECTURE)"
	env SYNTH=1 $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

run-force:
	@echo "🔄 강제 재생성 모드로 파이프라인 시작: $(LECTURE)"
	env FORCE=1 $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

run-master-force:
	@echo "🎙️🔄 마스터 오디오 강제 재생성 파이프라인 시작: $(LECTURE)"
	env FORCE=1 $(RUN_ENV_VARS) NARRATION_SOURCE=master node $(ENGINE_PATH) $(LECTURE)

regen-scene:
	@echo "🔄 특정 Scene 재생성: $(LECTURE) / Scene $(SCENE)"
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.wav 삭제 중..."; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene.wav; \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
		echo "  🗑️  scene-$$scene.webm 캡처 삭제 중..."; \
		rm -f packages/remotion/public/captures/$$LECTURE_ID/scene-$$scene.webm; \
	done
	node $(ENGINE_PATH) $(LECTURE)

render-scene:
	@echo "🎞️  씬 클립 렌더링: $(LECTURE) / Scene $(SCENE)"
	node $(ENGINE_RENDER_SCENE) $(LECTURE) $(SCENE)

record-webm:
	@echo "🎥 Playwright 씬 webm 녹화: $(LECTURE) / Scene $(SCENE)"
	@if [ -z "$(SCENE)" ]; then \
		echo "❌ SCENE 값을 지정해 주세요. 예: make record-webm LECTURE=lecture-03.json SCENE='17 18'"; \
		exit 1; \
	fi
	@echo "🔨 automation 패키지 빌드 중..."
	npm run build -w packages/automation
	node $(ENGINE_RECORD_WEBM) $(LECTURE) $(SCENE)

align-master-audio:
	@echo "🧭 마스터 오디오 alignment 생성: $(LECTURE)"
	@if [ -z "$(AUDIO)" ]; then \
		echo "❌ AUDIO 값을 지정해 주세요. 예: make align-master-audio LECTURE=lecture-03.json AUDIO=input/master-audio/lecture-03/master.wav MODEL=small"; \
		exit 1; \
	fi
	@echo "🔨 automation 패키지 빌드 중..."
	npm run build -w packages/automation
	@ALIGN_PATH=$${ALIGN:-tmp/audio-segmentation/$$(basename "$(LECTURE)" .json)/alignment.json}; \
	echo "   - alignment 출력: $$ALIGN_PATH"; \
	node $(ENGINE_ALIGN_MASTER_AUDIO) $(LECTURE) $(AUDIO) --output $$ALIGN_PATH --model $${MODEL:-small}

import-master-audio:
	@echo "🎙️ 마스터 오디오 씬 분할: $(LECTURE)"
	@if [ -z "$(AUDIO)" ]; then \
		echo "❌ AUDIO 값을 지정해 주세요. 예: make import-master-audio LECTURE=lecture-03.json AUDIO=input/master-audio/lecture-03/master.wav ALIGN=tmp/audio-segmentation/lecture-03/alignment.json"; \
		exit 1; \
	fi
	@if [ -z "$(ALIGN)" ]; then \
		echo "❌ ALIGN 값을 지정해 주세요. 예: make import-master-audio LECTURE=lecture-03.json AUDIO=input/master-audio/lecture-03/master.wav ALIGN=tmp/audio-segmentation/lecture-03/alignment.json"; \
		exit 1; \
	fi
	@echo "🔨 automation 패키지 빌드 중..."
	npm run build -w packages/automation
	node $(ENGINE_IMPORT_MASTER_AUDIO) $(LECTURE) $(AUDIO) $(ALIGN)

import-master-audio-auto:
	@echo "🎙️ 마스터 오디오 자동 분할: $(LECTURE)"
	@if [ -z "$(AUDIO)" ]; then \
		echo "❌ AUDIO 값을 지정해 주세요. 예: make import-master-audio-auto LECTURE=lecture-03.json AUDIO=input/master-audio/lecture-03/master.wav MODEL=small"; \
		exit 1; \
	fi
	@echo "🔨 automation 패키지 빌드 중..."
	npm run build -w packages/automation
	@ALIGN_PATH=$${ALIGN:-tmp/audio-segmentation/$$(basename "$(LECTURE)" .json)/alignment.json}; \
	echo "   - alignment 출력: $$ALIGN_PATH"; \
	node $(ENGINE_ALIGN_MASTER_AUDIO) $(LECTURE) $(AUDIO) --output $$ALIGN_PATH --model $${MODEL:-small}; \
	node $(ENGINE_IMPORT_MASTER_AUDIO) $(LECTURE) $(AUDIO) $$ALIGN_PATH

concat-scenes:
	@echo "🔗 씬 클립 이어붙이기: $(LECTURE)"
	node $(ENGINE_CONCAT_SCENES) $(LECTURE)

render-only:
	@echo "🎬 Remotion 렌더링만 실행 중..."
	npm run render -w packages/remotion

preview:
	@echo "📸 컴포넌트 프리뷰 이미지 생성 중..."
	@echo "사용법: make preview SCENE=6"
	@echo "       make preview SCENE=6 FRAME=45"
	@node scripts/preview.mjs $(LECTURE) $(SCENE) $(FRAME)

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

save-auth:
	@echo "🔐 브라우저 인증 상태 저장: $(SERVICE)"
	@if [ -z "$(SERVICE)" ]; then \
		echo "❌ SERVICE 값을 지정해 주세요. 예: make save-auth SERVICE=claude"; \
		exit 1; \
	fi
	npx tsx packages/automation/src/presentation/cli/save-auth.ts $(SERVICE)

clean:
	@echo "🧹 생성된 에셋 및 결과물 정리 중..."
	rm -rf packages/remotion/public/audio/*
	rm -rf packages/remotion/public/captures/*
	rm -rf packages/remotion/public/state-captures/*
	rm -rf packages/remotion/public/screenshots/*
	rm -rf $(OUTPUT_DIR)/clips
	rm -rf $(OUTPUT_DIR)/*.mp4
	@echo "✅ 정리가 완료되었습니다."

# --- 스크린샷 옵션 테스트 ---

preview-browser-mock:
	@echo "📸 [옵션B] BrowserMockScreen 프리뷰 생성 중..."
	@echo "   샘플: $(SAMPLE_LECTURE) / Scene 1"
	@node scripts/preview.mjs $(SAMPLE_LECTURE) 1 45

capture-screenshots:
	@echo "📷 [옵션A] Playwright 스크린샷 캡처 중..."
	@echo "   강의: $(LECTURE)"
	npx tsx scripts/capture-screenshots.ts $(LECTURE)

preview-screenshot:
	@echo "📸 [옵션A] ImageScreen(캡처 이미지) 프리뷰 생성 중..."
	@echo "   샘플: $(SAMPLE_LECTURE) / Scene 2"
	@node scripts/preview.mjs $(SAMPLE_LECTURE) 2 45

preview-springs:
	@echo "🌀 스프링 프리셋 비교 프리뷰 생성 중..."
	@echo "   default · gentle · bouncy · snappy · smooth × 프레임 5·15·30"
	@node scripts/preview-spring-compare.mjs

test-screenshot-options:
	@echo "🧪 스크린샷 옵션 테스트 시작"
	@echo ""
	@echo "━━━ [옵션B] BrowserMockScreen ━━━"
	@$(MAKE) preview-browser-mock SAMPLE_LECTURE=$(SAMPLE_LECTURE)
	@echo ""
	@echo "━━━ [옵션A] Playwright 스크린샷 캡처 ━━━"
	@$(MAKE) capture-screenshots LECTURE=$(SAMPLE_LECTURE)
	@echo ""
	@echo "━━━ [옵션A] ImageScreen 프리뷰 ━━━"
	@$(MAKE) preview-screenshot SAMPLE_LECTURE=$(SAMPLE_LECTURE)
	@echo ""
	@echo "✅ 테스트 완료 — output/preview/ 폴더에서 PNG를 확인하세요"
