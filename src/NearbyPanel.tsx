import { useEffect, useMemo, useState } from 'react';
import type { LocalPoint } from './domain/location';
import { nearbyStations } from './domain/nearby';
import stations from './data/stations.json';
import { StationMap } from './map/StationMap';

export function NearbyPanel({ point, kind, selectedStationId = null, onStationSelect, onSelectionClear }: {
  point: LocalPoint | null;
  kind: 'origin' | 'destination';
  selectedStationId?: string | null;
  onStationSelect?: (station: { id: string; name: string }, point: LocalPoint) => void;
  onSelectionClear?: () => void;
}) {
  const [consent, setConsent] = useState<LocalPoint | null>(null);
  useEffect(() => { setConsent(null); }, [point]);
  const label = kind === 'origin' ? '출발지' : '목적지';
  const base = useMemo(() => point ? nearbyStations(point, stations, 500) : [], [point]);
  const expanded = point !== null && consent === point && base.length === 0;
  const results = useMemo(() => point && expanded ? nearbyStations(point, stations, 1000) : base, [point, expanded, base]);
  const selectedId = results.some(station => station.id === selectedStationId) ? selectedStationId : null;
  return <section className="nearby-panel" aria-labelledby={`${kind}-nearby-title`}>
    <h2 id={`${kind}-nearby-title`}>{label} 주변 정류장</h2>
    <p className="privacy-note">2026-10-28 수집 당시 사용 중인 공공 정류장 자료입니다. 좌표계는 미확인 상태로 경도·위도로 잠정 해석했습니다. 현재 운행 여부는 확인되지 않았습니다. 거리는 직선거리입니다.</p>
    {!point ? <p role="status">{label}를 먼저 지정해 주세요.</p> : <>
      <p role="status">{expanded ? '1km' : '500m'} 이내 정류장 {results.length}개</p>
      {results.length === 0 && <p>해당 반경에서 정류장을 찾지 못했습니다.</p>}
      {base.length === 0 && !expanded && <button type="button" onClick={() => setConsent(point)}>이 {label}에서 1km까지 확대</button>}
      {expanded && <button type="button" onClick={() => { setConsent(null); onSelectionClear?.(); }}>500m로 돌아가기</button>}
      <StationMap point={point} stations={results} selectedId={selectedId}
        onSelect={station => onStationSelect?.(station, point)} />
      <ul aria-label={`${label} 주변 정류장 목록`}>{results.map(station => <li key={station.id}>
        <button type="button" aria-pressed={selectedId === station.id} onClick={() => onStationSelect?.(station, point)}>
          {station.name} · ID {station.id} · 직선거리 약 {Math.round(station.distanceMeters)}m
        </button>
      </li>)}</ul>
      {selectedId && <p role="status">정류장 ID {selectedId} 선택됨. 아래 도착정보 조회 버튼으로 확인할 수 있습니다.</p>}
    </>}
  </section>;
}
