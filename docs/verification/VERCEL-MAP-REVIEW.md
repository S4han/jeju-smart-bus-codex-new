# Vercel 지도 확인용 전환

확인일: 2026-10-29 (Asia/Seoul). 사용자 지시: 앞으로 Vercel에 배포해 확인, 지도 적용 계속 진행. 새 프로젝트 jeju-smart-bus-codex-new만 대상. TASK-004의 FR-004/AC-004·FR-020/AC-020 부분 및 확인용 배포, 전체 출시 완료 아님.

## 구현

정적/ID 없는 단일 HTML 확인용 배포에서 지도 SDK를 사용할 수 있는 실행 앱 배포로 전환했다. vercel.json은 npm run build:vercel과 review-dist를 사용한다. prepare-vercel-map.mjs는 검증된 dist의 HTML/자산만 복사하고 data-deployment-review=true를 HTML에 표시한다. 공개 지도 식별자는 Vercel 빌드 환경의 VITE_NAVER_MAP_CLIENT_ID 하나를 기존 승인대로 브라우저 번들에 반영한다. 값/부분/해시를 문서·로그·커밋에 남기지 않는다. 값은 Vercel 설정에만 저장해야 하며 서버 비밀키는 배포하지 않는다. 배포 메타데이터 deployment.json에는 지도 설정 존재 여부의 불리언만 기록한다.

지도 허용 출처는 기존 HTTP localhost와 새 프로젝트의 정확한 HTTPS origin https://jeju-smart-bus-codex-new.vercel.app이다. 임의 *.vercel.app·다른 포트·HTTP 배포 주소·유사 접미 도메인은 허용하지 않는다. 기존 NAVER 앱/기존 Vercel 주소는 재사용하지 않는다. 출발/목적 위치별 명시적 동의, 거부 후 목록 사용, 실패 후 자동 재시도 금지, 기존 CSP를 유지한다. 배포 전환 자체가 SDK를 자동 로드하지 않는다.

BIS 예산은 19/19 소진 상태를 유지한다. 배포 화면의 조회 버튼은 예산 소진 안내와 함께 비활성화하고, requestArrivals 함수도 배포 origin 또는 HTML 배포 표시를 감지하면 fetch 전에 429 상태를 반환한다. 배포 출력에 Python API/서버 키/ledger를 넣지 않는다. /api/*는 정적 api-disabled.json으로 rewrite하므로 외부 BIS로 전달하지 않는다. 이 정적 JSON 자체는 HTTP 200이며 실제 HTTP 429 서버 API인 것처럼 주장하지 않는다. SDK 진입 누적 3회 및 nrbe 루트 진단 1회 이력/실검증 잠금은 그대로다.

## 사용자 계정에서 필요한 설정

다음은 코드로 대체할 수 없는 계정 설정이며 기존 설정을 다시 발급하라는 뜻이 아니다.

1. **새 Vercel 프로젝트**의 Environment Variables에 VITE_NAVER_MAP_CLIENT_ID가 없다면, Codex 환경에서 사용하던 **새 NAVER Application의 동일 공개 Client ID**를 Production 범위에 등록한다. 값을 채팅으로 보내지 않는다. JEJU_BUS_API_KEY나 Client Secret은 추가하지 않는다.
2. **새 NAVER Application**의 Web 서비스 URL 허용 목록에 https://jeju-smart-bus-codex-new.vercel.app 을 추가한다. 기존 http://localhost와 기존 한도/초과 비허용 설정은 유지한다. 기존 앱은 수정하지 않는다.
3. Vercel 환경변수는 빌드 시 반영되므로 등록 후 main 최신 커밋을 재배포한다. 계정 설정 완료를 알려주면 Git 연동으로 새 배포를 시작할 수 있다. 실제 지도 동의는 사용자 브라우저에서 하고, 실패 시 반복 새로고침/동의로 요청을 늘리지 않는다.

현재 도구는 Vercel/NAVER 관리 계정 설정을 조회·변경할 수 없다. 설정 여부를 추정해 완료로 표시하지 않는다. 로컬 Codex 변수 존재와 Vercel 변수 존재는 다르다. 실제 Vercel 번들의 지도 구성 여부는 deployment.json의 mapConfigured 불리언으로 확인할 수 있다. mapConfigured=true는 도메인 인증/타일 성공을 뜻하지 않는다.

## 검증

npm test: Vitest 152개+Node guard 3개 통과. 추가 3개는 정확한 지도 origin 허용·배포 DOM 표시 없는 경우에도 BIS 차단·임의 preview origin에서 배포 표시로 BIS 차단이다. npm run build:vercel 타입 검사·빌드·클라이언트 비밀값 검사 통과. 로컬 빌드의 지도 공개 구성 존재=true를 값 없이 확인했다. 이는 Vercel 설정 관측이 아니다.

scripts/verify-deployed-map.cjs는 실제 배포 origin과 미승인 origin을 Playwright로 재현하되 모든 자산/SDK를 로컬 응답으로 가로챈다. 동의 전/거부 후 SDK 0회, 동의 후 스텁 1회, 목록/정류장 마커 집합 일치, 배포 BIS 버튼 비활성, 미승인 origin 지도 차단, 실제 외부 요청 0을 확인했다. 공개 지도 ID가 들어갈 수 있는 원문 요청 URL은 출력하지 않았다. 실제 NAVER·BIS·호스트 루트 요청은 이번 변경에 없다.

기존 build:review 및 독립 HTML 생성기는 ID 없는 오프라인 미리보기 용도로 유지한다. 기존 verify-vercel-review.cjs는 build:review 산출물에 적용하는 검사이며 지도 배포 산출물에는 verify-deployed-map.cjs를 사용한다. 실제 타일/도메인 인증·운영 비용·법적 개인정보 게이트는 여전히 미확인이다. 기존 두 저장소·기존 Vercel 프로젝트·메일 변경 없음.
