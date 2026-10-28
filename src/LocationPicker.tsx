import { useEffect, useState, useSyncExternalStore } from 'react';
import { LocalLocation, type LocationFailure } from './domain/location';
import { requestDevicePosition } from './browser/position';
import stations from './data/stations.json';

const messages: Record<LocationFailure, string> = {
  denied: '위치 권한이 허용되지 않았습니다. 좌표로 출발지를 지정할 수 있습니다.',
  unavailable: '현재 위치를 확인하지 못했습니다. 좌표로 지정하거나 다시 시도해 주세요.',
  timeout: '위치 확인 시간이 초과됐습니다. 좌표로 지정하거나 다시 시도해 주세요.',
  unsupported: '이 브라우저에서는 위치 확인을 사용할 수 없습니다. 좌표로 지정해 주세요.',
  insecure: '현재 연결에서는 위치 권한을 요청할 수 없습니다. 좌표로 지정해 주세요.',
  invalid: '위도는 -90~90, 경도는 -180~180 범위의 숫자로 입력해 주세요.',
};

export function LocationPicker({ kind = 'origin', model }: { kind?: 'origin' | 'destination'; model?: LocalLocation }) {
  const origin = kind === 'origin';
  const label = origin ? '출발지' : '목적지';
  const [location] = useState(() => model ?? new LocalLocation(origin ? requestDevicePosition : undefined));
  const state = useSyncExternalStore(location.subscribe, location.getSnapshot);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const search = query.trim();
  const matches = search ? stations.filter(station => station.name.includes(search)) : [];
  const reset = () => { location.clear(); setLatitude(''); setLongitude(''); setQuery(''); setSelectedName(''); };
  useEffect(() => {
    const forget = () => { location.clear(); setLatitude(''); setLongitude(''); setQuery(''); setSelectedName(''); };
    window.addEventListener('pagehide', forget);
    return () => { window.removeEventListener('pagehide', forget); location.clear(); };
  }, [location]);

  return (
    <section className="location-picker" aria-labelledby={`${kind}-title`}>
      <h2 id={`${kind}-title`}>{label} 지정</h2>
      <p className="privacy-note">위치는 이 화면에서만 사용하며 앱 서버나 지도 서비스로 보내지 않습니다.{origin && ' 브라우저·운영체제가 위치를 확인하는 과정에는 해당 제공자의 정책이 적용됩니다.'}</p>
      {origin && <button type="button" className="primary" disabled={state.status === 'pending'} onClick={() => {
        setLatitude(''); setLongitude(''); setQuery(''); setSelectedName(''); location.request();
      }}>{state.status === 'pending' ? '현재 위치 확인 중…' : '현재 위치 사용'}</button>}
      <fieldset>
        <legend>정류장명으로 지정</legend>
        <p className="privacy-note">2026-10-28 공공 정류장 목록에서 검색합니다. 일반 장소 검색은 제공하지 않습니다. 좌표계 미확인 자료를 잠정 사용합니다.</p>
        <label htmlFor={`${kind}-station-query`}>정류장명<input id={`${kind}-station-query`} type="text" autoComplete="off" value={query} onChange={e => {
          location.clear(); setSelectedName(''); setLatitude(''); setLongitude(''); setQuery(e.target.value);
        }} /></label>
        {search && <>
          <p role="status">검색 결과 {matches.length}개. 목록에서 선택해야 {label}로 지정됩니다.</p>
          <ul aria-label={`${label} 정류장 검색 결과`}>{matches.map(station => <li key={station.id}>
            <button type="button" onClick={() => {
              location.selectManual(String(station.latitude), String(station.longitude));
              setSelectedName(`${station.name} · ID ${station.id}`); setQuery(''); setLatitude(''); setLongitude('');
            }}>{station.name} · ID {station.id}</button>
          </li>)}</ul>
        </>}
        {state.status === 'selected' && selectedName && <p>선택한 정류장: {selectedName}</p>}
      </fieldset>
      <fieldset>
        <legend>좌표로 직접 지정</legend>
        <p className="privacy-note">알고 있는 위도·경도를 입력하고 {label}로 선택해 주세요.</p>
        <div className="coordinate-fields">
          <label htmlFor={`${kind}-latitude`}>위도<input id={`${kind}-latitude`} type="text" inputMode="decimal" autoComplete="off" value={latitude} onChange={e => { location.clear(); setQuery(''); setSelectedName(''); setLatitude(e.target.value); }}/></label>
          <label htmlFor={`${kind}-longitude`}>경도<input id={`${kind}-longitude`} type="text" inputMode="decimal" autoComplete="off" value={longitude} onChange={e => { location.clear(); setQuery(''); setSelectedName(''); setLongitude(e.target.value); }}/></label>
        </div>
        <button type="button" className="secondary" onClick={() => {
          location.selectManual(latitude, longitude);
          if (location.getSnapshot().status === 'selected') { setLatitude(''); setLongitude(''); }
        }}>이 좌표를 {label}로 선택</button>
      </fieldset>
      <div role="status" aria-live="polite" className="location-status">
        {state.status === 'idle' && `아직 ${label}를 선택하지 않았습니다.`}
        {state.status === 'pending' && '브라우저 위치 권한을 확인해 주세요. 기다리지 않고 좌표로 지정할 수도 있습니다.'}
        {state.status === 'error' && messages[state.reason]}
        {state.status === 'selected' && <><strong>{state.source === 'device' ? '현재 위치' : '입력한 좌표'}를 {label}로 선택했습니다.</strong><span>아래에서 주변 정류장을 확인할 수 있습니다. 경로 조회는 준비 중입니다.</span></>}
      </div>
      <button type="button" className="text-button" onClick={reset}>{origin ? '위치 지우기' : '목적지 지우기'}</button>
    </section>
  );
}
