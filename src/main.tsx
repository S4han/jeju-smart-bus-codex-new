import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  return (
    <main>
      <header><a className="brand" href="#main">제주 스마트 버스<span>JEJU SMART BUS</span></a><span className="badge">준비 중</span></header>
      <section id="main" className="intro" aria-labelledby="title">
        <p className="eyebrow">제주의 하루, 더 편안한 이동</p>
        <h1 id="title">어디로 가시나요?</h1>
        <p className="description">정확한 버스 정보를 확인할 수 있도록 준비하고 있습니다.</p>
        <div className="journey" aria-label="경로 검색 준비 상태">
          <div className="place"><span className="dot" aria-hidden="true"/><div><strong>출발지</strong><p>위치 기능 준비 중</p></div></div>
          <div className="connector" aria-hidden="true"/>
          <div className="place"><span className="dot destination" aria-hidden="true"/><div><strong>목적지</strong><p>장소 검색 준비 중</p></div></div>
          <button disabled>버스 경로 찾기</button>
          <p className="hint">데이터 검증이 끝나면 검색을 이용할 수 있습니다.</p>
        </div>
      </section>
      <section className="notice" aria-labelledby="notice-title"><span className="notice-icon" aria-hidden="true">i</span><div><h2 id="notice-title">확인된 정보만 안내합니다</h2><p>현재 버스 조회와 경로 검색은 제공하지 않습니다. 위치 권한을 요청하거나 위치를 저장하지 않습니다.</p></div></section>
      <footer>제주 스마트 버스 <span>내 이동을 위한 작은 안내</span></footer>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('App root is missing');
createRoot(root).render(<App />);
