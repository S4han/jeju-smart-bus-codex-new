import { useEffect, useRef, useState } from 'react';
import { ArrivalPanel, type ArrivalSnapshot } from './ArrivalPanel';
import { requestArrivals } from './browser/arrivals';

export function ArrivalLookup({ stationId, stationName }: { stationId: string | null; stationName: string | null }) {
  const [result, setResult] = useState<ArrivalSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const clear = () => { controller.current?.abort(); controller.current = null; setResult(null); setPending(false); };
    clear(); window.addEventListener('pagehide', clear);
    return () => { window.removeEventListener('pagehide', clear); controller.current?.abort(); };
  }, [stationId]);
  const load = async () => {
    if (!stationId || controller.current) return;
    const request = new AbortController(); controller.current = request;
    setPending(true); setResult(null);
    const timer = window.setTimeout(() => request.abort(), 90_000);
    try {
      const snapshot = await requestArrivals(stationId, request.signal);
      if (!request.signal.aborted && controller.current === request) setResult(snapshot);
    } catch {
      if (controller.current === request) setResult({ stationId, httpStatus: 503, resultCode: null, rows: null, mapping: [] });
    } finally {
      window.clearTimeout(timer);
      if (controller.current === request) { controller.current = null; setPending(false); }
    }
  };
  return <>
    {stationId && <div className="arrival-panel">
      <button type="button" disabled={pending} onClick={load}>{pending ? '도착정보 조회 중…' : '선택 정류장 도착정보 조회'}</button>
      <p className="privacy-note">버튼을 누르면 공개 정류장 ID만 앱 서버에 전달합니다. 좌표는 전송하지 않습니다. 자동 갱신 없이 승인된 검증 예산 안에서 조회합니다.</p>
    </div>}
    <ArrivalPanel selectedStationId={stationId} selectedStationName={stationName}
      snapshot={result?.stationId === stationId ? result : null} loading={pending && controller.current !== null} />
  </>;
}
