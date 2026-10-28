import { createRoot } from 'react-dom/client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { LocationPicker } from './LocationPicker';
import { ArrivalPanel } from './ArrivalPanel';
import { NearbyPanel } from './NearbyPanel';
import { LocalLocation, type LocalPoint } from './domain/location';
import { requestDevicePosition } from './browser/position';
import './style.css';

function App() {
  const [locations] = useState(() => ({ origin: new LocalLocation(requestDevicePosition), destination: new LocalLocation() }));
  const origin = useSyncExternalStore(locations.origin.subscribe, locations.origin.getSnapshot);
  const destination = useSyncExternalStore(locations.destination.subscribe, locations.destination.getSnapshot);
  const [stationSelection, setStationSelection] = useState<{
    kind: 'origin' | 'destination'; point: LocalPoint; id: string; name: string;
  } | null>(null);
  const originPoint = origin.status === 'selected' ? origin.point : null;
  const destinationPoint = destination.status === 'selected' ? destination.point : null;
  const selectedPoint = stationSelection?.kind === 'origin' ? originPoint : destinationPoint;
  const station = stationSelection?.point === selectedPoint ? stationSelection : null;
  useEffect(() => {
    setStationSelection(current => current && current.point !==
      (current.kind === 'origin' ? originPoint : destinationPoint) ? null : current);
  }, [originPoint, destinationPoint]);
  const bothSelected = origin.status === 'selected' && destination.status === 'selected';
  return (
    <main>
      <header><a className="brand" href="#main">제주 스마트 버스<span>JEJU SMART BUS</span></a><span className="badge">준비 중</span></header>
      <section id="main" className="intro" aria-labelledby="title">
        <p className="eyebrow">제주의 하루, 더 편안한 이동</p>
        <h1 id="title">어디로 가시나요?</h1>
        <p className="description">정확한 버스 정보를 확인할 수 있도록 준비하고 있습니다.</p>
        <div className="journey" aria-label="경로 검색 준비 상태">
          <LocationPicker model={locations.origin} />
          <div className="connector" aria-hidden="true"/>
          <LocationPicker kind="destination" model={locations.destination} />
          <button disabled>버스 경로 찾기</button>
          <p className="hint" role="status">{bothSelected
            ? '출발지와 목적지를 지정했습니다. 버스 데이터 검증이 끝나면 경로 조회를 이용할 수 있습니다.'
            : '출발지와 목적지를 각각 지정해 주세요. 경로 조회는 버스 데이터 검증 후 제공됩니다.'}</p>
        </div>
      </section>
      <NearbyPanel kind="origin" point={originPoint} selectedStationId={station?.kind === 'origin' ? station.id : null}
        onSelectionClear={() => setStationSelection(current => current?.kind === 'origin' ? null : current)}
        onStationSelect={(selected, point) => setStationSelection({ ...selected, point, kind: 'origin' })} />
      <NearbyPanel kind="destination" point={destinationPoint} selectedStationId={station?.kind === 'destination' ? station.id : null}
        onSelectionClear={() => setStationSelection(current => current?.kind === 'destination' ? null : current)}
        onStationSelect={(selected, point) => setStationSelection({ ...selected, point, kind: 'destination' })} />
      <ArrivalPanel selectedStationId={station?.id ?? null} selectedStationName={station?.name ?? null} snapshot={null} />
      <section className="notice" aria-labelledby="notice-title"><span className="notice-icon" aria-hidden="true">i</span><div><h2 id="notice-title">확인된 정보만 안내합니다</h2><p>현재 버스 조회와 경로 검색은 제공하지 않습니다. 현재 위치 사용 버튼을 눌렀을 때만 위치 권한을 요청합니다. 위치 지우기 또는 화면을 떠나면 앱의 위치 선택을 해제합니다.</p></div></section>
      <footer>제주 스마트 버스 <span>내 이동을 위한 작은 안내</span></footer>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('App root is missing');
createRoot(root).render(<App />);
