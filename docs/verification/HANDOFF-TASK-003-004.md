# TASK-003 완료 / TASK-004 환경 전환 인계

기록일: 2026-10-28 (Asia/Seoul).
대상 저장소: S4han/jeju-smart-bus-codex-new.
보존 브랜치: feat/task-003-development-foundation.

## 사용자 승인과 범위

- 새 저장소에 React·TypeScript·Vite 앱/테스트/빌드 기반 작성 승인 완료.
- U-003: 버전 + 순서 있는 구간별 노선 ID·방향·승차/하차 순번으로 경로 ID를 만드는 규칙 승인 완료. 구현됨.
- NAVER 지도 선택·새 앱 전용 공개 Client ID의 브라우저 전달 구조 승인 완료. 비밀키 공개 허용은 아님.
- S4han/jeju-smart-bus, S4han/jeju-smart-bus-codex 및 모든 기존 Vercel 설정·배포 변경 금지 유지.
- 사용자 결정이 필요한 경우 외에는 작업을 계속한다. 같은 환경 설정을 반복 요청하지 않는다. 질문은 한국어로 작성한다.

## 현재 코드와 검증

- TASK-003 기반 완료: 준비 상태의 한국어 화면, 외부 기능 비활성, 순수 정류장/정차행/도착행 검증, 결과 상태, 승인된 경로 ID와 최종 동률 비교.
- Node 24.19.0, npm 11.9.0. npm test 67개 통과, npm run build 타입 검사·Vite 빌드·클라이언트 비밀값/금지 API 참조 검사 통과. 실제 브라우저·모바일 검증은 미실행.
- 앱은 현재 env를 읽지 않고 SDK·위치·API를 호출하지 않는다. .env.example은 빈 공개 Client ID 자리표시자만 있다. 실키·응답 원문·사용자 좌표 없음.
- 상세: TASK-003.md, TASK-004-PREPARATION.md, TASK-002-LIVE-BIS.md, TASK-002-DATA-CONTRACT.md.

## API 실측을 승계할 때의 주의

공식 HWP의 http://busopen.jeju.go.kr/OpenAPI/service/bis/를 키·사용자 위치 없이 조회하여 정상 완결 8회, StationRoute 전체 요청 크기 제한 중단 1회, 누적 9/13회다. 기본 연결에 제공기관 문의가 필수라는 이전 판단은 철회했다. Claude 저장소는 읽기 전용으로 참고했고 그 검증 통과를 자동 이식하지 않았다.

GATE-01~04 부분, GATE-05 보류, GATE-06 부분, PRIV 기존 부분/보류 유지. 두 노선 활성행의 개수·기점·종점·순서 정합성을 확인했고 도착정보에는 2024년 과거행이 섞여 있다. 신선도 임계치·측지계·전체 관계·시간 산식 미확정. 전체 StationRoute 응답이 32 MiB 제한을 넘어 중단되어 재시도하지 않았다. 새 환경이라는 이유로 호출 예산을 초기화하지 않는다. /tmp의 XML 원문은 이 브랜치에 포함하지 않으며 없으면 있다고 가정하지 않는다.

## NAVER 설정 — 이미 사용자가 완료한 항목

- Maps 대표 계정임은 사용자 확인 완료.
- 기존 Claude 앱 화면: 일 한도 3,000·월 100,000, 초과 사용 비허용, 월 사용 45. 한도 적용 지연 수초 동안 초과 호출 가능성이 화면에 명시되어 있어 정확한 하드 차단으로 주장하지 않는다.
- 사용자 확인: 새 jeju-codex-new Application, Dynamic Map, http://localhost, 일 100·월 1,000, 초과 사용 비허용 설정 완료. 다른 계정 내 앱 유무/전체 사용량은 별도 미확인.
- VITE_NAVER_MAP_CLIENT_ID를 Codex 환경 변수로 추가하고 환경 게시 완료 화면을 확인했다. Client Secret 불필요. 값을 채팅에 요청하거나 출력하지 않는다.

## 환경 전환이 필요한 이유와 새 환경 확인 순서

이전 실행 환경은 설정 버전 cecfgver_6ae1d9f5722c81a383a3aa3eb979d36a를 계속 사용했다. runtime_variables에는 JEJU_BUS_API_KEY만 ready이고 프로세스의 지도 ID도 비어 있었다. 사용자의 새 설정 게시 성공과 이전 프로세스 미반영을 구분한다. 재등록·재발급·반복 게시를 요구하지 않는다.

1. 이 보존 브랜치의 AGENTS.md, IMPLEMENTATION_PLAN.md, 본 문서를 읽는다. main이나 예전 work에 최신 코드가 있다고 가정하지 않는다.
2. cloud-environment-runtime 스킬과 현재 환경 상태·network-policy.json을 읽는다. VITE_NAVER_MAP_CLIENT_ID의 ready/비어 있지 않음만 확인하고 값은 출력하지 않는다. 지도 ID는 승인된 공개 식별자이지만 환경 전체 덤프 금지.
3. 현재 허용 호스트는 이전 관측상 제주 3개뿐이다. 지도 호스트는 SDK 실제 사용 전 목적지 확인·지원 설정 경로로 검토한다. 무조건 도메인을 일괄 허용하지 않는다.
4. 실제 사용자 브라우저의 프리뷰 주소를 확인한다. http://localhost 등록이 클라우드 프리뷰와 일치한다고 가정하지 않는다. 기존 Vercel URL을 추가하지 않는다.
5. PRIV-001~004 및 지도 무료/합산/한도 조건을 확인한 후에만 관련 기능을 구현·활성화한다. 새 환경 변수가 보인다고 SDK를 즉시 로드하거나 GPS를 수집하지 않는다.
6. 필요 시 npm ci --cache /tmp/jeju-npm-cache, npm test, npm run build. 네트워크 명령은 지원되는 추가 네트워크 실행 권한을 사용한다. 이전 프록시 연결 실패는 기본 실행 권한 누락이었으며 사용자 설정 오류가 아니었다.

## 새 채팅 시작 문구

S4han/jeju-smart-bus-codex-new의 feat/task-003-development-foundation 브랜치에서 docs/verification/HANDOFF-TASK-003-004.md를 읽고 TASK-004를 이어가세요. 새로 게시한 VITE_NAVER_MAP_CLIENT_ID 반영을 값 노출 없이 확인하세요. 새 저장소 코드 작성·NAVER 공개 Client ID 구조·U-003은 승인됐습니다. 기존 두 저장소와 Vercel은 변경하지 마세요. 사용자 확인이 필요한 경우 외에는 계속 진행하고, 이미 완료한 설정을 다시 요청하지 마세요.
