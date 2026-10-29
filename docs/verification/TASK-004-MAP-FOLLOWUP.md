# TASK-004 지도 후속 1회 검증

확인일: 2026-10-29 (Asia/Seoul). 기준 브랜치 feat/task-003-development-foundation, e10c73c. 작업 위치 /workspace/work/task004. 판정: 실제 타일 표시 실패, 자동 재시도 없음. FR-004/AC-004 및 FR-020/AC-020 부분 상태 유지. TASK-004 전체 완료 아님.

## 이전 이력 보존

사용자 인계에 따라 이전 실제 SDK 진입 요청 1회 후 타일 실패를 승계한다. 그 뒤 재개 시도는 nrbe.map.naver.net 사전 검사 차단으로 추가 SDK 요청 0회였다. 이전 원문 결과는 새 환경에 없으며 재구성된 이력을 원문 실측으로 취급하지 않는다. BIS 누적 19/19 소진을 유지하며 새로운 서버 ledger/API 서버를 만들거나 실행하지 않았다.

## 환경 및 복구

cloud-environment-runtime 스킬에 따라 environment_status와 /etc/codex/network-policy.json을 확인했다. observations_current=true, 정책 enforced, 세 호스트 oapi.map.naver.com/nrbe.map.naver.net/static.naver.net 모두 허용. 지도 공개 식별자 변수 ready이며 값은 출력하지 않았다. 루트 HEAD 응답은 각각 404/503/403이었다. 이는 실제 SDK/타일 경로 성공을 뜻하지 않는다. 공식 SDK 문서: https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html (기존 확인 근거; 이번 추가 문서 조회 없음).

app.html img-src에 이전 관측 호스트 nrbe.map.naver.net/static.naver.net을 추가했다. 진단 스크립트는 세 호스트 사전 검사, CSP 위반의 호스트/지시문별 집계, 모든 /api/ 및 BIS 호스트 요청 차단, 전용 배타 예약 파일을 복구했다. 프록시와 TLS 검증을 유지한 Chromium localhost 앱에서 공공 정류소만 선택했다. 실제 사용자의 위치는 사용하지 않았다. 허용된 세 호스트 외 외부 요청은 차단한다.

## 실제 후속 결과

명령 node scripts/verify-map-live.cjs --live를 정확히 한 번 실행했다. SDK 진입 1회, 도착 API 0회, BIS 차단 대상 요청 0회. 누적 알려진 SDK 진입은 이전 1회+이번 1회=2회다. SDK 내부의 추가 리소스 요청은 별도이며 요청 수가 과금 수와 같다고 주장하지 않는다.

실제 타일 표시 성공 조건을 충족하지 못했다. CSP 위반은 oapi.map.naver.com script-src-elem 1회, nrbe.map.naver.net script-src-elem 3회, static.naver.net img-src 2회, kr-col-ext.nelo.navercorp.com connect-src 4회다. 원문 URL/쿼리/좌표/식별자는 기록하지 않았다. 호스트 집계는 요청 이벤트이며 제공자 도달 성공 증거가 아니다. 결과 JSON을 별도로 보존한다.

수정한 img-src가 빌드된 dist/index.html에도 포함됨을 확인했지만 static.naver.net 이미지 위반은 여전히 관측됐다. 리디렉션/중첩 정책/실제 경로 원인은 이번 집계만으로 확정하지 않는다. script-src에 호스트를 추가하는 것은 img-src 수정과 별도 검토가 필요하다. 관측된 수집 호스트는 허용하지 않았다. 실패 후 추가 요청이나 자동 재시도를 하지 않았다.

## 검증 및 다음 단계

139개 Vitest, 타입 검사, 빌드, 클라이언트 비밀값 검사 통과. 실제 검증은 실패로 기록한다. 새 Python API 테스트는 미실행(API 코드 변경 없음). 기존 저장소 두 개, 원격 브랜치, Vercel, 메일은 변경하지 않았다.

후속 실행 중복 방지를 위해 scratch의 naver-followup-once.reserved와 결과 파일을 보존했다. 새 환경에서 scratch가 사라져도 저장소의 TASK-004-MAP-FOLLOWUP-RESULT.json이 있으면 --live를 거부한다. 이 기록/예약을 지워 재시도하지 않는다. 다음 단계는 SDK의 동적 스크립트와 이미지 CSP 위반 원인을 오프라인 검토하는 것이다. 별도 실제 요청 지시 없이 추가 실검증하지 않는다. 일반 장소 검색/시간표 및 기존 개인정보·비용 게이트도 미완료다.

## 후속 오프라인 보완 — 2026-10-29

사용자의 계속 진행 지시에 따라 추가 실제 요청 없이 보완했다. localhost 응답에 별도 CSP 헤더가 없음을 확인했다. 기존 진단은 blockedURI의 호스트만 남겼으므로 static.naver.net/oapi.map.naver.com 위반이 HTTP 스킴 때문인지 확정할 수 없다. 원문 URL은 남기지 않고 앞으로 스킴·호스트·지시문을 집계하도록 수정했다. 과거 결과 JSON은 변경하지 않았다.

관측된 nrbe.map.naver.net의 동적 스크립트에 한정해 script-src를 추가했다. upgrade-insecure-requests로 HTTP 리소스를 HTTPS로 승격하고 HTTP 자체 허용·와일드카드·unsafe-eval·인라인 스크립트 허용은 추가하지 않았다. 이는 관측 기반 수정과 원인 후보에 대한 보완이며 실제 실패 원인 확정이나 실제 지도 성공 판정이 아니다. 수집 호스트 연결은 계속 CSP로 차단된다.

새 scripts/verify-map-csp.cjs는 모든 외부 요청을 로컬 응답으로 가로채 실제 NAVER 요청 없이 검증한다. HTTP oapi/nrbe 스크립트 및 static/nrbe 이미지가 HTTPS로 승격되어 표시되고, 미승인 외부 스크립트는 CSP가 차단함을 확인했다. 기존 모의 SDK 검증도 390/1280px에서 동의·목록/핀 일치·양방향 선택·정리·인증 실패·자동 재시도 없음이 통과했다. 타입/빌드/클라이언트 비밀값 검사도 통과했다. 실제 SDK 진입 누적 2회와 BIS 19/19, 후속 실행 잠금은 유지한다. 다음 실제 검증의 성공 여부는 미검증이며 이번 지시에서 추가 실호출하지 않았다.


## 차단 경계 및 진단 보강 — 2026-10-29

scripts/map-verification-guard.cjs로 실제 검증기의 네트워크 분류와 기존 시도 판정을 분리했다. API/BIS 요청을 최우선 차단하고 정확한 http://localhost:4173 출처 및 세 호스트의 기본 HTTPS 포트만 통과시킨다. 허용 호스트를 흉내 낸 접미 도메인·다른 포트·다른 로컬 서버는 차단한다. 기존 결과 경로는 실행 디렉터리에 의존하지 않도록 스크립트 기준으로 해석한다.

진단은 HTTP 상태를 호스트별로 집계하고 검증 단계(준비/타일 대기/마커 경계) 및 명시적 외부 차단 횟수를 구분한다. URL·쿼리·좌표·식별자 값은 저장하지 않는다. 이전 실측 JSON은 수정하지 않았다.

node --test scripts/map-verification-guard.test.cjs 3개 통과: BIS/로컬 API 차단, 정확한 출처·HTTPS 호스트만 허용, 예약 또는 저장소 결과 중 하나만 있어도 재실행 거부. CSP 브라우저 검증에서 실제 코드와 같은 guard로 /api/arrivals POST가 프록시 도달 전에 차단됨을 확인했다(합성 차단 시도 1회, 제공자 요청 0회). node scripts/verify-map-live.cjs --live는 기존 예약으로 브라우저 실행 전에 거부했다. 이는 새 실검증이 아니다.

독립 HTML과 제한 iframe 390/1180px, JavaScript 없는 기본 Index 검증도 통과했다. 이 변경에서 앱 기능 코드는 변경하지 않았고 전체 Vitest/빌드를 반복하지 않았다. 직전 앱 빌드/139개 테스트 통과 기록과 구분한다. 현 단계에서 승인된 1회 실제 검증은 이미 소진됐고 자동 재시도 금지는 유지된다. 실제 성공 여부를 확인하려면 별도 추가 1회 실검증 범위를 정해야 하며, 반복적인 오프라인 검사로 성공 판정을 대신하지 않는다.


## 추가 승인 실검증 결과 — 2026-10-29

사용자가 추가 실제 지도 검증 1회를 명시적으로 승인했다. scripts/verify-map-approved-once.cjs를 별도 작성해 이전 예약/결과는 그대로 두고 새 TASK-004-MAP-APPROVED.reserved와 TASK-004-MAP-APPROVED-RESULT.json으로 1회 실행을 잠갔다. localhost가 제공하는 CSP에 nrbe 스크립트 출처·두 이미지 출처·HTTPS 승격이 포함됨을 값 노출 없이 확인했다. 환경 관측 current 및 정책 enforced, 세 호스트 허용 상태도 재확인했다.

실행은 타일 대기 단계에서 실패했고 재시도하지 않았다. 이번 SDK 진입 요청은 1회, 이전 2회 포함 누적 알려진 진입은 3회다. SDK 내부 리소스 요청은 별도 집계한다. oapi.map.naver.com HTTP 200 2건, static.naver.net HTTP 200 1건, nrbe.map.naver.net HTTP 503 3건이 관측됐다. nrbe 실패 코드는 net::ERR_ABORTED 3건이며 실제 지도 타일 표시는 확인하지 못했다. BIS/도착 API 요청은 0회이고 19/19 예산을 유지한다.

이전의 oapi/nrbe 스크립트 및 static 이미지 CSP 위반은 이번에는 관측되지 않았다. 남은 CSP 위반은 https: kr-col-ext.nelo.navercorp.com connect-src 4건이며 수집 호스트는 계속 차단했다. nrbe HTTP 503은 CSP 출처 거부와 구분한다. 제공자와 관리 프록시 중 어느 계층이 503을 생성했는지는 현재 결과만으로 확정하지 않는다. 검증 뒤 환경 상태는 여전히 current/enforced이고 network_diagnostics는 null이어서 별도 원인 증거는 없다. 임의 호스트 추가나 TLS 우회, 추가 HEAD/SDK 요청으로 조사하지 않았다.

이 실행에서는 스크립트 구문 검사·서빙 CSP 검사·diff 공백 검사만 추가 수행했다. 기존 전체 테스트/빌드를 새로 실행한 것으로 주장하지 않는다. 원문 URL/쿼리/좌표/공개 ID 값은 출력·기록하지 않았다. 기존 두 저장소·원격 브랜치·Vercel·메일은 변경하지 않았다. FR-004/020과 TASK-004는 부분 상태 유지. 추가 실검증 승인분은 소진됐으며 새 예약/결과도 삭제하지 않는다.



## 타일 실패의 앱 안전 동작 — 2026-10-29

추가 실검증 뒤 사용자의 계속 진행 지시에 따라 외부 요청 없이 실패 UI를 보완했다. 기존 Canvas는 SDK의 Map 생성만으로 로딩 안내를 숨겨 실제 타일 미표시와 성공을 구분하지 못했다. 이제 초기 tilesloaded 이벤트 전에는 로딩 안내를 유지하고 20초 내 이벤트가 없으면 지도·타일 리스너·타이머를 정리하고 실패 안내/정류장 목록을 유지한다. 20초는 UI 대기 제한이며 제공자 응답 보장이나 도착정보 신선도 정책이 아니다. tilesloaded 이벤트도 실제 지도의 시각적 정확성/가용성 검증을 대신하지 않는다.

src/map/naver.ts의 공통 사용 불가 상태를 타일 시간 초과에도 적용했다. 위치를 지우고 다시 선택해도 같은 페이지에서는 SDK 재요청·지도 재생성 없이 실패 상태를 유지한다. 인증 실패·화면 이탈·unmount 때도 타일 리스너/타이머를 정리한다. 지도 좌표·식별자·URL 로그나 영구 저장소는 추가하지 않았다. FR-004/AC-004, FR-020/AC-020 실패 처리 및 NFR의 안전 동작 보완이며 전체 완료 선언은 아니다.

검증: npm test에서 139개 Vitest와 Node 차단 검증 3개 통과. 처음 전체 실행에서는 Node test 파일이 Vitest에 수집돼 실패했으므로 파일을 verify-map-guard.cjs로 변경하고 npm test가 두 실행기를 순서대로 호출하도록 수정했다. 의존성/lockfile은 변경하지 않았다. 타입 검사·빌드·클라이언트 비밀값 검사 통과. 모의 지도 390/1280px 정상 tilesloaded 후 로딩 안내 종료, 타일 이벤트 없는 상태를 가상 시계로 20초 경과시켜 지도 제거/목록 유지/재선택 후 SDK 1회·Map 1회 유지 확인. CSP 모의 검증과 독립 HTML/iframe/JS 비활성 Index 검증도 수행했다. 실제 제공자 요청은 추가하지 않았으며 SDK 진입 누적 3회·BIS 19/19 및 두 번의 후속 예약/결과는 유지한다.


## 타이머·늦은 이벤트 경계 검증 — 2026-10-29

모의 SDK에 지도 인스턴스/타일 리스너를 관찰하는 테스트 계측만 추가하고 외부 요청을 가로챘다. 위치 삭제 후 20초가 지나도 실패 상태가 새 위치로 전파되지 않으며 정상 재선택은 기존 SDK를 재사용한다. pagehide 후에는 지도가 한 번 제거되고 타일 리스너가 비활성화되며 타임아웃 실패가 발생하지 않는다. tilesloaded 완료 후에는 타임아웃이 실패로 바꾸지 않는다. 타임아웃 실패 뒤 이미 큐에 들어간 늦은 콜백을 직접 호출해도 핀이 다시 나타나거나 실패 안내가 사라지지 않는다. 전체 모의 지도 검증 통과. 앱 코드 변경 없이 검증을 보강했으므로 전체 테스트/빌드를 반복하지 않았다.

최신 인계 상단을 단일 요약으로 정리하고 이전 환경 원문은 과거 기록으로 보존했다. TASK-004 작업 문서에도 현재 부분 상태·검증·누적 예산을 반영했다. 실제 요청 추가 없음. 503 자체의 해소/지도 성공을 주장하지 않는다.


최신 연결 진단(2026-10-29): SDK/타일/BIS 경로 없는 nrbe 루트 GET 1회에서 HTTP 503 및 Envoy upstream remote connection failure를 확인했다. SDK 진입 추가 없음, 누적 3회·BIS 19/19 유지. 브라우저 CSP와 독립된 연결 실패 증거이며 발생 계층은 미확정이다. [진단 기록](TASK-004-MAP-NETWORK-DIAGNOSIS.md)을 따른다.
