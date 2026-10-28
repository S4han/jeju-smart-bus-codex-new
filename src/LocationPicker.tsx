import { useEffect, useState, useSyncExternalStore } from 'react';
import { LocalLocation, type LocationFailure } from './domain/location';
import { requestDevicePosition } from './browser/position';

const messages: Record<LocationFailure, string> = {
  denied: '위치 권한이 허용되지 않았습니다. 좌표로 출발지를 지정할 수 있습니다.',
  unavailable: '현재 위치를 확인하지 못했습니다. 좌표로 지정하거나 다시 시도해 주세요.',
  timeout: '위치 확인 시간이 초과됐습니다. 좌표로 지정하거나 다시 시도해 주세요.',
  unsupported: '이 브라우저에서는 위치 확인을 사용할 수 없습니다. 좌표로 지정해 주세요.',
  insecure: '현재 연결에서는 위치 권한을 요청할 수 없습니다. 좌표로 지정해 주세요.',
  invalid: '위도는 -90~90, 경도는 -180~180 범위의 숫자로 입력해 주세요.',
};

export function LocationPicker() {
  const [location] = useState(() => new LocalLocation(requestDevicePosition));
  const state = useSyncExternalStore(location.subscribe, location.getSnapshot);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const reset = () => { location.clear(); setLatitude(''); setLongitude(''); };
  useEffect(() => {
    const forget = () => { location.clear(); setLatitude(''); setLongitude(''); };
    window.addEventListener('pagehide', forget);
    return () => { window.removeEventListener('pagehide', forget); location.clear(); };
  }, [location]);

  return (
    <section className="location-picker" aria-labelledby="origin-title">
      <h2 id="origin-title">출발지 지정</h2>
      <p className="privacy-note">위치는 이 화면에서만 사용하며 앱 서버나 지도 서비스로 보내지 않습니다. 브라우저·운영체제가 위치를 확인하는 과정에는 해당 제공자의 정책이 적용됩니다.</p>
      <button type="button" className="primary" disabled={state.status === 'pending'} onClick={() => {
        setLatitude(''); setLongitude(''); location.request();
      }}>{state.status === 'pending' ? '현재 위치 확인 중…' : '현재 위치 사용'}</button>
      <fieldset>
        <legend>좌표로 직접 지정</legend>
        <p className="privacy-note">장소 검색은 준비 중입니다. 알고 있는 위도·경도를 입력하고 출발지로 선택해 주세요.</p>
        <div className="coordinate-fields">
          <label htmlFor="origin-latitude">위도<input id="origin-latitude" type="text" inputMode="decimal" autoComplete="off" value={latitude} onChange={e => { location.clear(); setLatitude(e.target.value); }}/></label>
          <label htmlFor="origin-longitude">경도<input id="origin-longitude" type="text" inputMode="decimal" autoComplete="off" value={longitude} onChange={e => { location.clear(); setLongitude(e.target.value); }}/></label>
        </div>
        <button type="button" className="secondary" onClick={() => {
          location.selectManual(latitude, longitude);
          if (location.getSnapshot().status === 'selected') { setLatitude(''); setLongitude(''); }
        }}>이 좌표를 출발지로 선택</button>
      </fieldset>
      <div role="status" aria-live="polite" className="location-status">
        {state.status === 'idle' && '아직 출발지를 선택하지 않았습니다.'}
        {state.status === 'pending' && '브라우저 위치 권한을 확인해 주세요. 기다리지 않고 좌표로 지정할 수도 있습니다.'}
        {state.status === 'error' && messages[state.reason]}
        {state.status === 'selected' && <><strong>{state.source === 'device' ? '현재 위치' : '입력한 좌표'}를 출발지로 선택했습니다.</strong><span>정류장·경로 조회는 데이터 검증 후 제공됩니다.</span></>}
      </div>
      <button type="button" className="text-button" onClick={reset}>위치 지우기</button>
    </section>
  );
}
