# Lecture Automation Makefile

.PHONY: help install run clean render-only

# 기본 변수 설정
LECTURE ?= p1-01-01.json
ENGINE_PATH = packages/automation/main.js
REMOTION_PATH = packages/remotion
OUTPUT_DIR = output

help:
	@echo "🎓 Lecture Automation CLI"
	@echo "--------------------------------------------------"
	@echo "make install         - 모든 패키지 의존성 설치"
	@echo "make run             - 전 공정 실행 (기본: p1-01-01.json)"
	@echo "make run LECTURE=xxx - 특정 강의 JSON 파일로 실행"
	@echo "make clean           - 생성된 모든 에셋 및 결과물 삭제"
	@echo "make render-only     - 에셋이 있을 때 Remotion 렌더링만 실행"
	@echo "--------------------------------------------------"

install:
	@echo "📦 의존성 설치 중..."
	npm install

run:
	@echo "🚀 강의 자동화 파이프라인 시작: $(LECTURE)"
	node $(ENGINE_PATH) $(LECTURE)

render-only:
	@echo "🎬 Remotion 렌더링만 실행 중..."
	npm run render -w packages/remotion

clean:
	@echo "🧹 생성된 에셋 및 결과물 정리 중..."
	rm -rf packages/remotion/public/audio/*
	rm -rf packages/remotion/public/captures/*
	rm -rf $(OUTPUT_DIR)/*.mp4
	@echo "✅ 정리가 완료되었습니다."
