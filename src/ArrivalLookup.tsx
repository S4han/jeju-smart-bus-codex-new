import { useEffect, useRef, useState } from 'react';
import { ArrivalPanel, type ArrivalSnapshot } from './ArrivalPanel';
import { ArrivalFormatError, requestArrivals } from './browser/arrivals';

export function ArrivalLookup({ stationId, stationName }: { stationId: string | null; stationName: string | null }) {
  const staticPreview = typeof document !== 'undefined' && document.documentElement.dataset.staticPreview === 'true';
  const [result, setResult] = useState<ArrivalSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const pendingTimer = useRef<number | null>(null);
  useEffect(() => {
    const clear = () => {
      controller.current?.abort(); controller.current = null;
      if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null; setResult(null); setPending(false); setCancelled(false);
    };
    clear(); window.addEventListener('pagehide', clear);
    return () => {
      window.removeEventListener('pagehide', clear); controller.current?.abort(); controller.current = null;
      if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    };
  }, [stationId]);
  const cancel = () => {
    controller.current?.abort(); controller.current = null;
    if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
    pendingTimer.current = null; setResult(null); setPending(false); setCancelled(true);
  };
  const load = async () => {
    if (staticPreview || !stationId || controller.current) return;
    const request = new AbortController(); controller.current = request;
    setPending(true); setResult(null); setCancelled(false);
    const timer = window.setTimeout(() => request.abort(), 90_000);
    pendingTimer.current = timer;
    try {
      const snapshot = await requestArrivals(stationId, request.signal);
      if (!request.signal.aborted && controller.current === request) setResult(snapshot);
    } catch (error) {
      if (controller.current === request) setResult({ stationId,
        httpStatus: error instanceof ArrivalFormatError ? 200 : 503, resultCode: null, rows: null, mapping: [] });
    } finally {
      if (controller.current === request) {
        window.clearTimeout(timer); controller.current = null; pendingTimer.current = null; setPending(false);
      }
    }
  };
  return <section id="arrival-area" aria-label="선택 정류장 도착 조회" tabIndex={-1}>
    {stationId && <div className="arrival-panel">
      <div className="arrival-actions">
        <button type="button" disabled={pending || staticPreview} onClick={load}>{staticPreview ? '화면 미리보기에서는 실시간 조회를 제공하지 않습니다' : pending ? '도착정보 조회 중…' : '선택 정류장 도착정보 조회'}</button>
        {pending && <button type="button" className="cancel" onClick={cancel}>조회 취소</button>}
      </div>
      {cancelled && <p role="status">화면의 조회를 취소했습니다. 자동으로 다시 조회하지 않습니다.</p>}
      {(pending || cancelled) && <p className="privacy-note">취소해도 이미 시작된 서버 조회는 진행될 수 있습니다.</p>}
      <p className="privacy-note">{staticPreview ? '정류장 검색과 주변 목록을 확인할 수 있습니다. 실제 도착정보는 앱 실행 환경에서 조회할 수 있습니다.' : '버튼을 누르면 공개 정류장 ID만 앱 서버에 전달합니다. 좌표는 전송하지 않습니다. 자동 갱신 없이 승인된 검증 예산 안에서 조회합니다.'}</p>
    </div>}
    <ArrivalPanel selectedStationId={stationId} selectedStationName={stationName}
      snapshot={result?.stationId === stationId ? result : null} loading={pending && controller.current !== null} />
  </section>;
}
