# 제주 스마트 버스 — Codex

OpenAI Codex로 독립 개발하는 제주 스마트 버스 모바일 웹 프로젝트입니다.

## 개발 원칙

- 저장소: `S4han/jeju-smart-bus-codex-new`
- Claude Code 저장소 `S4han/jeju-smart-bus`와 독립적으로 개발합니다.
- PRD, `AGENTS.md`, `IMPLEMENTATION_PLAN.md`를 기준으로 단계별 개발합니다.
- API 키 등 비밀정보는 저장소에 커밋하지 않습니다.

## 진행 상태

확정 PRD, 개발 규칙, 단계별 계획 및 TASK-001~008 문서가 준비되어 있습니다.
TASK-001 사전 설계·공식 문서 조사는 부분 완료이며, 계정별 무료 자격·차단 설정·외부 위치 처리 검증은 보류입니다.
TASK-002는 첨부 BIS 명세 검토 및 게이트 판정을 기록했으며, 현재 인증·HTTPS·무료 호출 조건 확인 전까지 실호출 보류입니다.
애플리케이션 코드·의존성·빌드 환경은 아직 구성하지 않았습니다.

- [개발 계획](IMPLEMENTATION_PLAN.md)
- [TASK-001 검증 기록](docs/verification/TASK-001.md)

- [TASK-002 게이트 판정](docs/verification/TASK-002.md)
- [첨부 BIS 명세 검토](docs/verification/TASK-002-BIS-SPEC.md)
