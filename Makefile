# Lecture Automation Makefile

.PHONY: help install build run run-force regen-scene clean render-only preview tts-sample

# 기본 변수 설정
LECTURE ?= p1-01-01.json
ENGINE_PATH = packages/automation/dist/presentation/cli/main.js
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
	done
	node $(ENGINE_PATH) $(LECTURE)

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
	rm -rf $(OUTPUT_DIR)/*.mp4
	@echo "✅ 정리가 완료되었습니다."
