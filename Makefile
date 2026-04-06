# Lecture Automation Makefile

.PHONY: help install build run run-force regen-scene render-scene concat-scenes clean render-only preview tts-sample \
        preview-browser-mock preview-screenshot capture-screenshots test-screenshot-options \
        preview-springs

# 기본 변수 설정
LECTURE ?= p1-01-01.json
SAMPLE_LECTURE ?= sample-screenshot-test.json
ENGINE_PATH = packages/automation/dist/presentation/cli/main.js
ENGINE_RENDER_SCENE = packages/automation/dist/presentation/cli/render-scene.js
ENGINE_CONCAT_SCENES = packages/automation/dist/presentation/cli/concat-scenes.js
REMOTION_PATH = packages/remotion
OUTPUT_DIR = output

help:
	@echo "🎓 Lecture Automation CLI"
	@echo "--------------------------------------------------"
	@echo "make install         - 모든 패키지 의존성 설치"
	@echo "make run             - 전 공정 실행 (기본: p1-01-01.json)"
	@echo "make run LECTURE=xxx - 특정 강의 JSON 파일로 실행"
	@echo "make run-force       - 기존 에셋 무시하고 전체 재생성"
	@echo "make clean           - 생성된 모든 에셋 및 결과물 삭제"
	@echo "make render-only     - 에셋이 있을 때 Remotion 렌더링만 실행"
	@echo "make preview SCENE=6 - 특정 씬의 프리뷰 이미지 생성 (PNG)"
	@echo "make tts-sample      - 현재 프로바이더로 TTS 샘플 생성"
	@echo "make tts-sample TTS=gemini_cloud_tts RATE=0.7 - 프로바이더/속도 지정"
	@echo "make regen-scene LECTURE=xxx SCENE=5       - 특정 씬 오디오만 재생성"
	@echo "make regen-scene LECTURE=xxx SCENE='5 12'  - 여러 씬 동시 재생성"
	@echo "make render-scene LECTURE=xxx SCENE=5      - 특정 씬 클립만 렌더링"
	@echo "make render-scene LECTURE=xxx SCENE='5 12' - 여러 씬 클립 렌더링"
	@echo "make concat-scenes LECTURE=xxx             - 씬 클립 이어붙여 최종 MP4 생성"
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

build:
	@echo "🔨 automation 패키지 빌드 중..."
	npm run build -w packages/automation

run:
	@echo "🚀 강의 자동화 파이프라인 시작: $(LECTURE)"
	node $(ENGINE_PATH) $(LECTURE)

run-force:
	@echo "🔄 강제 재생성 모드로 파이프라인 시작: $(LECTURE)"
	FORCE=1 node $(ENGINE_PATH) $(LECTURE)

regen-scene:
	@echo "🔄 특정 Scene 재생성: $(LECTURE) / Scene $(SCENE)"
	@LECTURE_ID=$$(node -e "const d=require('./data/$(LECTURE)'); console.log(d.lecture_id)"); \
	for scene in $(SCENE); do \
		echo "  🗑️  scene-$$scene.wav 삭제 중..."; \
		rm -f packages/remotion/public/audio/$$LECTURE_ID/scene-$$scene.wav; \
		echo "  🗑️  scene-$$scene.mp4 클립 삭제 중..."; \
		rm -f $(OUTPUT_DIR)/clips/$$LECTURE_ID/scene-$$scene.mp4; \
	done
	node $(ENGINE_PATH) $(LECTURE)

render-scene:
	@echo "🎞️  씬 클립 렌더링: $(LECTURE) / Scene $(SCENE)"
	node $(ENGINE_RENDER_SCENE) $(LECTURE) $(SCENE)

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

clean:
	@echo "🧹 생성된 에셋 및 결과물 정리 중..."
	rm -rf packages/remotion/public/audio/*
	rm -rf packages/remotion/public/captures/*
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
