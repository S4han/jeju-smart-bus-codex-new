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


## TASK-003 로컬 개발 기반

사용자 승인으로 React·TypeScript·Vite 기반을 작성했다. 버스 조회/위치/지도/경로 기능은 미활성 상태다. [TASK-003 검증](docs/verification/TASK-003.md), [현재 환경 API 실측](docs/verification/TASK-002-LIVE-BIS.md)을 참고한다. 위의 미구성 표기는 이전 기록이다.

Node 24에서 `npm ci`, `npm run dev`, `npm test`, `npm run build`, `npm run preview`를 사용한다. 제한된 환경의 npm 캐시는 `--cache /tmp/jeju-npm-cache`처럼 쓰기 가능한 경로를 지정할 수 있다. 환경 비밀값은 명령행이나 파일에 복사하지 않는다. 이 앱은 현재 환경변수를 필요로 하지 않는다.


## TASK-004 로컬 위치 지정

현재 위치 사용 버튼을 누를 때만 일회 위치 권한을 요청한다. 거부/실패 시 위도·경도로 수동 출발지를 지정할 수 있다. 앱은 위치를 서버/외부 지도 API에 보내거나 영구 저장하지 않으며, 위치 지우기/화면 이탈 시 선택을 해제한다. 브라우저·OS 자체 위치 산출 정책은 별도다.

정류장·지도·도착정보·장소명 검색·목적지/경로 검색은 아직 제공하지 않는다. 상세 판정과 실행 증거는 [TASK-004 검증](docs/verification/TASK-004.md)을 따른다. `npm test` 97개 및 빌드 통과. 제공된 Playwright/Chromium 환경에서는 preview 실행 후 `node scripts/verify-local-ui.cjs`로 가상 위치 UI 검증을 수행할 수 있다.

후속 도착정보 검증: 사용자 승인하에 공공 API 누적 13/13회 실측을 완료했고, 초기 신선도 기준 60초를 확정했다. `arrival-board` 순수 모듈은 매핑/신선도가 검증된 행만 반환한다. 현재 단위 테스트 111개·빌드 통과이며, 이 모듈의 정류장 선택/네트워크/UI 연결은 미완료다. [후속 실측](docs/verification/TASK-004-LIVE-FOLLOWUP.md)을 참고한다.

도착 표시 계층도 추가했다. 실제 앱에는 정류장 미선택 준비 상태만 표시하며, 외부 조회·예시 운행정보를 활성화하지 않는다. 60초 자동 만료·정류장 전환·빈 응답/장애/미확인 구분을 개발 전용 합성 화면에서 검증했다. 현재 테스트 120개·빌드 및 Chromium 1280px/390px 검증 통과. 실제 데이터 공급 연결은 미완료다.

출발지와 별도로 목적지 좌표도 수동 지정할 수 있다. 편집/삭제/화면 이탈 시 선택을 해제하고 상위 화면에서 두 지점의 선택 상태를 안내한다. 목적지용 GPS·외부 장소 검색은 호출하지 않는다. 두 위치를 지정해도 실제 경로 조회는 아직 제공하지 않는다.


## Vercel에서 확인

앞으로 새 프로젝트 https://jeju-smart-bus-codex-new.vercel.app 에서 확인합니다. `main` push가 Git 자동 배포를 시작합니다. 빌드는 `npm run build:vercel`, 출력은 `review-dist`입니다. 지도는 해당 고정 도메인에서만 사용자 동의 후 로드하며 BIS 서버 구현은 준비됐지만 함수 배포와 공유 영속 예산 장부 연결이 아직 완료되지 않아 실제 조회는 비활성입니다. 사용자 승인 검증 예산은 누적 23/30회 사용·잔여 7회이며 방문자가 직접 소비하지 않습니다. [공개 지도 ID/도메인 설정 및 검증 범위](docs/verification/VERCEL-MAP-REVIEW.md)를 확인하세요. 기존 두 프로젝트는 변경하지 않습니다.

ID 없는 오프라인 미리보기는 `npm run build:review`로 계속 만들 수 있습니다.
