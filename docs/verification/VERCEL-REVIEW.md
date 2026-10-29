# Vercel 확인용 배포 준비

확인일: 2026-10-29 (Asia/Seoul). 사용자가 현재 구현을 Vercel에서 확인하도록 배포 요청. 기존 두 저장소·Vercel 프로젝트를 변경하지 않고 새 프로젝트만 대상으로 한다. TASK-008 전체 출시 검토/운영 승인과 구분한다.

## 현재 상태

확인용 정적 배포 설정/산출물 검증 완료, 실제 Vercel 업로드 및 URL 발급은 미실행이다. 현재 실행 환경에는 Vercel 도구/CLI·인증 토큰·조직/프로젝트 연결이 없고 네트워크 정책에도 Vercel 호스트가 없다. GitHub push 가능 여부와 Vercel 배포 권한은 별개다. 키나 Vercel 토큰을 채팅으로 요청하지 않는다. 기존 프로젝트를 찾아 재사용/수정하지 않았다.

## 사용자가 새 프로젝트에서 수행할 단계

1. https://vercel.com/new 에서 GitHub 저장소 S4han/jeju-smart-bus-codex-new를 새 프로젝트로 Import한다. 기존 jeju-smart-bus / jeju-smart-bus-codex는 선택하지 않는다. 새 프로젝트 이름 예: jeju-smart-bus-codex-review.
2. 배포할 Git 브랜치는 feat/task-003-development-foundation이다. Import 화면에서 브랜치를 고를 수 없다면 새 프로젝트의 Settings → Git → Production Branch를 이 브랜치로 지정하고 해당 브랜치로 새 배포를 만든다. main의 초기 문서 상태를 배포하지 않는다. 개인 Hobby 계정을 사용할 수 있다면 그 범위를 사용하고 유료 플랜/추가 상품을 신청하지 않는다.
3. Root Directory는 저장소 루트다. vercel.json에서 Framework=null, Build Command=npm run build:review, Output Directory=review-dist, Install Command=npm ci를 지정했다. UI가 별도 override를 요구하면 이 값으로 맞춘다. 환경변수는 추가하지 않는다. Node는 package.json의 24.x를 따른다.
4. 배포 완료 후 발급된 URL을 연다. 실제 URL/배포 성공은 Vercel 결과로 확인해야 하며 이 문서는 성공 증거가 아니다.

Vercel UI의 표기는 변경될 수 있다. 현재 Vercel 관리 화면/계정 요금 상태는 이 환경에서 확인하지 못했다. GitHub 연결/프로젝트 생성은 사용자 계정 인증이 필요한 단계다.

## 확인 가능한 기능

정류장명 검색, 출발/목적 위치 선택, 주변 정류장 목록, 조건부 1km 확대, 정류장 선택과 도착 패널 이동, 반응형 화면을 확인할 수 있다. 사용자 위치는 기존 동의 버튼을 누를 때만 브라우저가 요청하며 앱 메모리에서만 사용한다.

실제 NAVER 지도·마커와 도착정보·경로 검색은 이 확인용 배포에서 제공하지 않는다. 지도는 기존 localhost 제한/제공자 등록 주소가 유지되고 BIS 19/19 예산이 소진된 상태다. 지도 표식을 포함한 구현은 모의 SDK 검증만 통과했으며 이 정적 배포가 지도 성공을 대신하지 않는다. 배포 도메인에서 실제 지도를 활성화하려면 새 주소에 대한 제공자 등록/앱 허용 범위를 별도로 적용하고 한정된 실검증을 계획해야 한다. 기존 Vercel 도메인/기존 NAVER 앱 설정을 재사용하지 않는다.

## 산출물 및 검증

npm run build:review는 기존 빌드/비밀값 검사를 거친 뒤 ID를 비운 독립 미리보기만 review-dist/index.html에 복사한다. 원래 실행 앱 dist 및 로컬 Python API는 배포 출력에 포함하지 않는다. prepare-vercel-review.mjs에서 정적 모드/CSP connect-src none/현재 설정값 미포함을 확인한다. .vercelignore는 로컬 환경 파일/DB/서버/중간 출력 업로드를 제외한다. .vercel 연결 파일도 Git에서 제외한다.

vercel.json은 no-store, no-referrer, nosniff 응답 헤더를 지정했다. CSP는 생성 HTML의 내용 해시 기반 메타 정책을 사용한다. API 프록시/서버리스 함수/외부 데이터 수집/배포 hook은 추가하지 않았다.

npm run build:review 통과. node scripts/verify-vercel-review.cjs는 산출물을 로컬 HTTP로 서빙하며 390/1280px에서 검색·양쪽 선택·실시간 조회 비활성·지도 동의 버튼 없음·외부/API 요청 0·페이지 오류 없음·가로 넘침 없음과 캐시/리퍼러 헤더를 확인했다. 이는 로컬 호스팅 모의 검증이며 Vercel 실배포 검증이 아니다. 앱 코드 변경이 없어 전체 단위 테스트를 반복하지 않았다. 기존 149개 Vitest+3개 Node guard 결과와 구분한다.

이번 실제 SDK/BIS/호스트 루트 요청은 없으며 SDK 진입 누적 3회·BIS 19/19·별도 nrbe 루트 진단 1회를 유지한다. Vercel 청구/사용량/플랜별 제한은 실계정 미확인이고 실제 배포 비용 0원을 검증했다고 주장하지 않는다. 기존 두 저장소·기존 Vercel·메일 변경 없음.
