import { useEffect, useState } from 'react';
import { APPROVED_ARRIVAL_MAX_AGE_MS, buildArrivalBoard, type ArrivalBoard } from './domain/arrival-board';
import type { StopEvent } from './domain/bis';

export interface ArrivalSnapshot {
  readonly stationId: string;
  readonly httpStatus: number;
  readonly resultCode: unknown;
  readonly rows: readonly Readonly<Record<string, unknown>>[] | null;
  readonly mapping: readonly StopEvent[];
}
interface ArrivalPanelProps {
  selectedStationId: string | null;
  selectedStationName?: string | null;
  snapshot: ArrivalSnapshot | null;
  loading?: boolean;
}
const unavailableMessages = {
  quota: '조회 한도에 도달해 도착정보를 확인할 수 없습니다.',
  network: '연결 문제로 도착정보를 확인할 수 없습니다.',
  format: '받은 도착정보의 형식을 확인할 수 없습니다.',
  upstream: '정보 제공처의 응답을 확인할 수 없습니다.',
  policy: '도착정보의 신선도 기준을 확인할 수 없습니다.',
};
const koreanTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

function ArrivalContent({ board }: { board: ArrivalBoard }) {
  if (board.status === 'unavailable') return <p role="status">{unavailableMessages[board.reason]}</p>;
  if (board.status === 'empty') return <p role="status">제공된 도착정보가 없습니다. 버스 미운행을 뜻하지는 않습니다.</p>;
  if (board.arrivals.length === 0) return <p role="status">실시간 정보 미확인: 최신 정보와 정류장 연결을 확인할 수 없습니다.</p>;
  const excluded = Object.values(board.excluded).reduce((sum, count) => sum + count, 0);
  return <>
    <ul className="arrival-list" aria-label="검증된 도착 예측">
      {board.arrivals.map((arrival, index) => <li key={`${arrival.routeId}:${arrival.order}:${index}`}>
        <span>노선 ID {arrival.routeId}</span>
        <strong>산출 당시 예측 {arrival.predictedMinutes}분</strong>
        <span>{arrival.remainingStops}정류장 전</span>
        <small>산출시각 (한국시간) <time dateTime={arrival.observedAt}>{koreanTime.format(Date.parse(arrival.observedAt))}</time></small>
      </li>)}
    </ul>
    {excluded > 0 && <p className="privacy-note">일부 정보는 시각·연결·중복 검증을 통과하지 못해 표시하지 않습니다.</p>}
    <p className="privacy-note">도로 상황에 따라 달라질 수 있는 예측입니다. 경과시간만큼 도착 예측을 임의로 줄이지 않습니다.</p>
  </>;
}

/** Display-only adapter. It neither loads data nor schedules provider requests. */
export function ArrivalPanel({ selectedStationId, selectedStationName = null, snapshot, loading = false }: ArrivalPanelProps) {
  const [, refresh] = useState(0);
  const nowMs = Date.now();
  const matching = selectedStationId !== null && snapshot?.stationId === selectedStationId;
  const board = !loading && matching && snapshot ? buildArrivalBoard({
    stationId: snapshot.stationId, httpStatus: snapshot.httpStatus, resultCode: snapshot.resultCode,
    rows: snapshot.rows, mapping: snapshot.mapping, nowMs, maxAgeMs: APPROVED_ARRIVAL_MAX_AGE_MS,
  }) : null;
  const nextExpiry = board?.status === 'checked' && board.arrivals.length > 0
    ? Math.min(...board.arrivals.map(row => Date.parse(row.observedAt) + APPROVED_ARRIVAL_MAX_AGE_MS + 1))
    : null;

  useEffect(() => {
    if (nextExpiry === null) return;
    const timer = window.setTimeout(() => refresh(value => value + 1), Math.max(0, nextExpiry - Date.now()));
    return () => window.clearTimeout(timer);
  }, [nextExpiry]);
  useEffect(() => {
    const recheck = () => refresh(value => value + 1);
    const visible = () => { if (document.visibilityState === 'visible') recheck(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('pageshow', recheck);
    return () => {
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('pageshow', recheck);
    };
  }, []);

  return <section className="arrival-panel" aria-labelledby="arrival-title" aria-busy={loading}>
    <h2 id="arrival-title">정류장 도착정보</h2>
    {selectedStationId !== null && <p>선택 정류장: {selectedStationName ? `${selectedStationName} · ` : ''}ID {selectedStationId}</p>}
    {selectedStationId === null ? <p role="status">아직 선택된 정류장이 없습니다. 주변 목록에서 정류장을 선택해 주세요.</p> :
      loading ? <p role="status">선택한 정류장의 도착정보를 확인하고 있습니다.</p> :
        board ? <ArrivalContent board={board} /> : <p role="status">선택한 정류장의 도착정보가 확인되지 않았습니다.</p>}
    <p className="privacy-note">검증된 산출시각으로부터 60초 이내인 정보만 표시합니다. 검증된 대체 시간표가 없어 시간표 기반 추정은 제공하지 않습니다.</p>
  </section>;
}
