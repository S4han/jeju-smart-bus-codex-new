import { useEffect, useRef, useState } from 'react';
import { createStationPin, updateStationPin } from './markerContent';
import { offsetToReveal } from './viewport';
import type { LocalPoint } from '../domain/location';
import type { NearbyResult } from '../domain/nearby';
import { hasMapClientId, loadNaverMaps, markMapUnavailable, type MapInstance, type NaverMaps } from './naver';

function Canvas({ point, stations, selectedId, onSelect }: {
  point: LocalPoint; stations: readonly NearbyResult[]; selectedId: string | null;
  onSelect: (station: NearbyResult) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState<{ maps: NaverMaps; map: MapInstance } | null>(null);
  const [tilesReady, setTilesReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const pins = useRef<{ id: string; element: HTMLButtonElement }[]>([]);
  const selected = useRef(selectedId); selected.current = selectedId;
  const callback = useRef(onSelect); callback.current = onSelect;
  useEffect(() => {
    let disposed = false; let map: MapInstance | null = null;
    let tileTimer: number | undefined;
    let removeTileListener: (() => void) | undefined;
    const destroy = () => {
      disposed = true; window.clearTimeout(tileTimer);
      removeTileListener?.(); removeTileListener = undefined;
      map?.destroy(); map = null;
    };
    const unavailable = () => { destroy(); setReady(null); setFailed(true); };
    window.addEventListener('pagehide', destroy);
    window.addEventListener('jeju-map-unavailable', unavailable);
    loadNaverMaps().then(maps => {
      if (disposed || !element.current) return;
      const created = new maps.Map(element.current, { center: new maps.LatLng(point.latitude, point.longitude), zoom: 15 });
      if (disposed) { created.destroy(); return; }
      map = created;
      tileTimer = window.setTimeout(() => { if (!disposed) markMapUnavailable(); }, 20_000);
      const listener = maps.Event.addListener(created, 'tilesloaded', () => {
        if (disposed) return;
        window.clearTimeout(tileTimer); setTilesReady(true);
      });
      removeTileListener = () => maps.Event.removeListener(listener);
      setReady({ maps, map });
    }).catch(() => { if (!disposed) { unavailable(); markMapUnavailable(); } });
    return () => {
      window.removeEventListener('pagehide', destroy);
      window.removeEventListener('jeju-map-unavailable', unavailable); destroy();
    };
  }, [point]);
  useEffect(() => {
    if (!ready) return;
    const markers = stations.map(station => {
      const element = createStationPin(station.id, station.name);
      updateStationPin(element, station.id === selected.current);
      const choose = () => callback.current(station);
      const keydown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault(); event.stopPropagation(); choose();
      };
      element.addEventListener('keydown', keydown);
      const marker = new ready.maps.Marker({ map: ready.map,
        position: new ready.maps.LatLng(station.latitude, station.longitude),
        title: station.name, icon: { content: element, anchor: new ready.maps.Point(22, 22) } });
      const listener = ready.maps.Event.addListener(marker, 'click', choose);
      return { id: station.id, element, keydown, marker, listener };
    });
    pins.current = markers;
    return () => {
      pins.current = [];
      for (const { element, keydown, marker, listener } of markers) {
        element.removeEventListener('keydown', keydown);
        ready.maps.Event.removeListener(listener); marker.setMap(null);
      }
    };
  }, [ready, stations]);
  useEffect(() => {
    for (const pin of pins.current) updateStationPin(pin.element, pin.id === selectedId);
  }, [ready, stations, selectedId]);
  useEffect(() => {
    if (!ready || stations.length === 0) return;
    ready.map.fitBounds([new ready.maps.LatLng(point.latitude, point.longitude),
      ...stations.map(station => new ready.maps.LatLng(station.latitude, station.longitude))],
    { maxZoom: 15, top: 30, right: 30, bottom: 30, left: 30 });
  }, [ready, stations, point]);
  useEffect(() => {
    if (!ready || !selectedId) return;
    const station = stations.find(station => station.id === selectedId);
    if (!station) return;
    const projection = ready.map.getProjection();
    const target = new ready.maps.LatLng(station.latitude, station.longitude);
    const offset = offsetToReveal(projection.fromCoordToOffset(target),
      projection.fromCoordToOffset(ready.map.getCenter()), ready.map.getSize(),
      { top: 30, right: 30, bottom: 30, left: 30 });
    if (offset) ready.map.panTo(projection.fromOffsetToCoord(new ready.maps.Point(offset.x, offset.y)));
  }, [ready, stations, selectedId]);
  useEffect(() => {
    if (!ready || !element.current) return;
    const resize = new ResizeObserver(() => ready.map.autoResize()); resize.observe(element.current);
    return () => resize.disconnect();
  }, [ready]);
  return <>
    {failed && <p role="status">지도를 확인하지 못했습니다. 등록 주소·연결·이용 한도를 확인해 주세요. 정류장 목록은 계속 이용할 수 있습니다.</p>}
    {!failed && !tilesReady && <p role="status">지도를 불러오는 중입니다.</p>}
    <div ref={element} className="station-map" aria-label="주변 정류장 NAVER 지도" />
    <p className="privacy-note">지도에는 현재 목록과 같은 정류장만 표시합니다. 지도 확대·이동은 검색 반경이나 목록을 바꾸지 않습니다.</p>
  </>;
}

export function StationMap({ point, stations, selectedId, onSelect }: {
  point: LocalPoint; stations: readonly NearbyResult[]; selectedId: string | null;
  onSelect: (station: NearbyResult) => void;
}) {
  const [consent, setConsent] = useState<LocalPoint | null>(null);
  const [declined, setDeclined] = useState(false);
  useEffect(() => { setConsent(null); setDeclined(false); }, [point]);
  const staticPreview = document.documentElement.dataset.staticPreview === 'true';
  const available = !staticPreview && location.hostname === 'localhost' && hasMapClientId();
  return <div className="map-panel">
    <h3>정류장 지도</h3>
    {!available ? <p className="privacy-note">{staticPreview ? '화면 미리보기에서는 외부 지도를 불러오지 않습니다. 정류장 목록을 이용해 주세요.' : '이 실행 환경에서는 지도를 제공하지 않습니다. 정류장 목록을 이용해 주세요.'}</p> : consent === point ? <>
      <Canvas point={point} stations={stations} selectedId={selectedId} onSelect={onSelect} />
      <button type="button" onClick={() => location.reload()}>지도 동의 철회 및 위치 지우기</button>
      <p className="privacy-note">철회하면 화면을 새로 열어 지도와 위치 선택을 지웁니다.</p>
    </> : <>
      <p className="privacy-note">NAVER 지도를 표시하면 선택 위치의 좌표·지도 영역·서비스 이용정보·IP 등이 네이버클라우드㈜·네이버㈜에 전달되어 보관·활용될 수 있습니다. 항목별 보유기간은 확인되지 않았습니다. 동의하지 않아도 목록은 이용할 수 있습니다. 동의는 저장하지 않습니다.</p>
      {declined && <p role="status">지도 없이 목록을 이용합니다.</p>}
      <button type="button" onClick={() => setConsent(point)}>동의하고 정류장 지도 보기</button>
      <button type="button" onClick={() => setDeclined(true)}>지도 없이 이용</button>
    </>}
  </div>;
}
