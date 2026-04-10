# AGENTS.md — Lecture Automation

> **Note**: 이 파일은 OpenAI Codex 등 AGENTS.md를 참조하는 외부 에이전트 전용이다.
> Claude Code는 CLAUDE.md를 사용하며, 이 파일을 참조하지 않는다.

## 강의 스크립트 작성

강의 스크립트 작성·수정 시 반드시 아래 문서를 참조한다:

- [docs/script-guidelines.md](docs/script-guidelines.md) — 스크립트 작성 규칙 (톤, 분량, 포맷, 금지사항)
- [docs/curriculum-basic.md](docs/curriculum-basic.md) — 기초편 커리큘럼 (10시간, 25강)

## 강의 스크립트 레뷰

스크립트 레뷰 시 반드시 아래 문서를 참조한다:

- [docs/script-review-guide.md](docs/script-review-guide.md) — 레뷰 가이드 (커리큘럼 준거, 전후 강의 연계, 후속 영향 체크)

레뷰의 핵심 관점:
1. 커리큘럼의 해당 강의 항목이 빠짐없이 반영되어 있는가
2. 전후 강의와의 도입 복습·마무리 예고가 정확한가
3. 후속 강의에서 다룰 개념을 과도하게 선취하거나, 잘못된 약속을 하고 있지 않은가

## 스크립트 → JSON 변환

확정된 스크립트를 Remotion 입력 JSON으로 변환할 때:

- [docs/json-conversion-rules.md](docs/json-conversion-rules.md) — 변환 규칙
- [docs/component-props-reference.md](docs/component-props-reference.md) — 컴포넌트 Props 명세
