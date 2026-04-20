# Lecture Automation Makefile

.PHONY: help install build run run-force regen-scene regen-visual run-tts-only run-render-only render-scene record-webm concat-scenes clean preview preview-motion icon-coverage tts-sample \
        sync-playwright save-auth validate-schema lint lint-fix audit

# 기본 변수 설정
LECTURE ?= lecture-01-01.json
ENGINE_PATH = packages/automation/dist/presentation/cli/main.js
ENGINE_RENDER_SCENE = packages/automation/dist/presentation/cli/render-scene.js
ENGINE_RECORD_WEBM = packages/automation/dist/presentation/cli/record-webm.js
ENGINE_CONCAT_SCENES = packages/automation/dist/presentation/cli/concat-scenes.js
REMOTION_PATH = packages/remotion
OUTPUT_DIR = output
RUN_ENV_VARS = $(if $(strip $(MODEL)),MODEL="$(MODEL)")

help:
	@echo "🎓 Lecture Automation CLI"
	@echo "--------------------------------------------------"
	@echo "make install         - 모든 패키지 의존성 설치"
	@echo "make install-align-deps - 마스터 오디오 정렬용 Python 가상환경 생성"
	@echo "make run             - 전 공정 실행 (기본: lecture-01-01.json)"
	@echo "make run LECTURE=xxx - 특정 강의 JSON 파일로 실행"
	@echo "                       config/tts.json의 activeProvider로 씬별 TTS 생성"
	@echo "make run-force       - 기존 에셋 무시하고 전체 재생성"
	@echo "make clean           - 생성된 모든 에셋 및 결과물 삭제"
	@echo "make preview SCENE=6 - 특정 씬의 프리뷰 이미지 생성 (PNG)"
	@echo "make preview-motion LECTURE=lecture-01-03.json SCENE=6 - 특정 씬의 no-audio 모션 프리뷰 생성"
	@echo "make preview-motion LECTURE=lecture-01-03.json SCENE=6 DURATION=150 - 프리뷰 길이 지정"
	@echo "make icon-coverage   - lecture JSON의 icon 매핑 누락/오타 검사"
	@echo "make tts-sample      - 현재 프로바이더로 TTS 샘플 생성"
	@echo "make tts-sample TTS=gemini_cloud_tts RATE=0.7 - 프로바이더/속도 지정"
	@echo "make regen-scene LECTURE=xxx SCENE=5       - 특정 씬만 빠르게 재생성 (TTS·webm·클립 모두)"
	@echo "make regen-scene LECTURE=xxx SCENE='5 12'  - 여러 씬 동시 재생성"
	@echo "make regen-visual LECTURE=xxx SCENE='6 14' - 씬 visual만 재생성 (webm + 클립, TTS 유지)"
	@echo "make run-tts-only LECTURE=xxx SCENE='1 2 3' - 지정 씬 TTS만 재생성 + 미리 듣기 파일 생성"
	@echo "make run-render-only LECTURE=xxx      - TTS/캡처 제외하고 전체 씬 렌더링 & 클립 병합만 재실행"
	@echo "make render-scene LECTURE=xxx SCENE=5      - 특정 씬 클립만 렌더링"
	@echo "make render-scene LECTURE=xxx SCENE='5 12' - 여러 씬 클립 렌더링"
	@echo "make record-webm LECTURE=xxx SCENE=17      - 특정 Playwright 씬 webm 재생성"
	@echo "make record-webm LECTURE=xxx SCENE='17 18' - 여러 Playwright 씬 webm 재생성"
	@echo "make concat-scenes LECTURE=xxx             - 씬 클립 이어붙여 최종 MP4 생성"
	@echo "make sync-playwright LECTURE=xxx           - Playwright 씬 narration-action 싱크 자동 조정"
	@echo "make sync-playwright LECTURE=xxx SCENE=17  - 특정 씬만 싱크 조정"
	@echo "make save-auth SERVICE=claude             - 브라우저 인증 상태 저장 (Claude/ChatGPT 등)"
	@echo "make lint LECTURE=xxx                     - 강의 JSON lint 검사 (TTS 지뢰, 기호 위반 등)"
	@echo "make lint-fix LECTURE=xxx                 - lint + 자동 수정 가능 항목 적용"
	@echo "make audit LECTURE=xxx                    - TTS 오독 자동 감사 (Gemini 2.0 Flash STT 대조)"
	@echo "make audit LECTURE=xxx SCENE='5 31'       - 특정 씬만 감사"
	@echo "--------------------------------------------------"

install:
	@echo "📦 의존성 설치 중..."
	npm install

build:
	@echo "🔨 automation 패키지 빌드 중..."
	npm run build -w packages/automation

run: lint
	@echo "🚀 강의 자동화 파이프라인 시작: $(LECTURE)"
	env $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

run-force: lint
	@echo "🔄 강제 재생성 모드로 파이프라인 시작: $(LECTURE)"
	env FORCE=1 $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

regen-scene: build
	@echo "🔄 특정 Scene 재생성: $(LECTURE) / Scene $(SCENE)"
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.wav 삭제 중..."; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene.wav; \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
		echo "  🗑️  scene-$$scene.webm 캡처 삭제 중..."; \
		rm -f packages/remotion/public/captures/$$LECTURE_ID/scene-$$scene.webm; \
		echo "  🗑️  session 캡처 디렉토리 삭제 중 (shared 씬)..."; \
		find packages/remotion/public/state-captures/$$LECTURE_ID -type d -name "scene-$$scene" -exec rm -rf {} + 2>/dev/null || true; \
	done
	env TARGET_SCENES="$(SCENE)" node $(ENGINE_PATH) $(LECTURE)

regen-visual: build
	@echo "🎞️  Visual 씬만 재생성 (TTS 유지): $(LECTURE) / Scene $(SCENE)"
	@if [ -z "$(SCENE)" ]; then \
		echo "❌ SCENE 값을 지정해 주세요. 예: make regen-visual LECTURE=lecture-01-04.json SCENE='6 14'"; \
		exit 1; \
	fi
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
		echo "  🗑️  scene-$$scene.webm 캡처 삭제 중..."; \
		rm -f packages/remotion/public/captures/$$LECTURE_ID/scene-$$scene.webm; \
		echo "  🗑️  session 캡처 디렉토리 삭제 중 (shared 씬)..."; \
		find packages/remotion/public/state-captures/$$LECTURE_ID -type d -name "scene-$$scene" -exec rm -rf {} + 2>/dev/null || true; \
	done
	env TARGET_SCENES="$(SCENE)" node $(ENGINE_PATH) $(LECTURE)

run-tts-only:
	@echo "🔊 TTS만 생성: $(LECTURE) / Scene $(SCENE)"
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.wav 삭제 중..."; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene.wav; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene.alignment.json; \
	done
	env TTS_ONLY=1 TARGET_SCENES="$(SCENE)" $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

run-render-only:
	@echo "🎞️ 사전 준비(TTS, 캡처) 건너뛰고 렌더링 & 병합 시퀀스 실행: $(LECTURE)"
	env RENDER_ONLY=1 $(RUN_ENV_VARS) node $(ENGINE_PATH) $(LECTURE)

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

concat-scenes:
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
