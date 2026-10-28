import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArrivalPanel, type ArrivalSnapshot } from '../src/ArrivalPanel';

// Synthetic display cases. No captured public responses or personal locations.
const stationId = '406000001';
const row = { routeId: '405000001', stationOrd: '24', updnDir: '0', arrvVhId: '123',
  predictTravTm: '20', leftStation: '17', calcDate: '2026-10-28T21:40:49+09:00' };
const snapshot: ArrivalSnapshot = { stationId, httpStatus: 200, resultCode: '00', rows: [row],
  mapping: [{ routeId: row.routeId, stationId, order: 24, direction: '0' }] };
const view = (data: ArrivalSnapshot | null, selected: string | null = stationId, loading = false) =>
  renderToStaticMarkup(<ArrivalPanel snapshot={data} selectedStationId={selected} loading={loading} />);

describe('arrival display (AC-005/014)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T21:41:28+09:00')); });
  afterEach(() => vi.useRealTimers());
  it('does not show arrivals without an explicit selected station', () => {
    const html = view(snapshot, null);
    expect(html).toContain('아직 선택된 정류장이 없습니다.');
    expect(html).not.toContain('산출 당시 예측');
  });
  it('does not use the previous station snapshot after selection changes', () => {
    const html = view(snapshot, '406000002');
    expect(html).toContain('선택한 정류장의 도착정보가 확인되지 않았습니다.');
    expect(html).not.toContain(row.routeId);
  });
  it('hides old results while a new request is pending', () => {
    const html = view(snapshot, stationId, true);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('도착정보를 확인하고 있습니다.');
    expect(html).not.toContain('산출 당시 예측');
  });
  it('displays source prediction, explicit route ID and Korean source timestamp', () => {
    const html = view(snapshot);
    expect(html).toContain('산출 당시 예측 20분');
    expect(html).toContain('노선 ID 405000001');
    expect(html).toContain('산출시각 (한국시간)');
    expect(html).toContain('21:40:49');
    expect(html.toLowerCase()).toContain(`datetime="${row.calcDate.toLowerCase()}"`);
    expect(html).toContain('시간표 기반 추정은 제공하지 않습니다.');
  });
  it('does not invent countdown predictions or timetable estimates', () => {
    vi.setSystemTime(new Date('2026-10-28T21:41:48+09:00'));
    expect(view(snapshot)).toContain('산출 당시 예측 20분');
    vi.setSystemTime(new Date('2026-10-28T21:41:49.001+09:00'));
    const expired = view(snapshot);
    expect(expired).toContain('실시간 정보 미확인');
    expect(expired).not.toContain('산출 당시 예측');
  });
  it('distinguishes an upstream empty result from untrusted rows', () => {
    const empty = view({ ...snapshot, rows: [] });
    expect(empty).toContain('제공된 도착정보가 없습니다.');
    expect(empty).toContain('버스 미운행을 뜻하지는 않습니다.');
    const untrusted = view({ ...snapshot, mapping: [] });
    expect(untrusted).toContain('실시간 정보 미확인');
    expect(untrusted).not.toContain('제공된 도착정보가 없습니다.');
  });
  it('does not let extra provider metadata extend the approved display age', () => {
    vi.setSystemTime(new Date('2026-10-28T21:42:00+09:00'));
    const withExtraMetadata = { ...snapshot, maxAgeMs: 3_600_000 };
    const html = view(withExtraMetadata);
    expect(html).toContain('실시간 정보 미확인');
    expect(html).not.toContain('산출 당시 예측');
  });
  it('shows only checked rows and indicates partial exclusions', () => {
    const html = view({ ...snapshot, rows: [row, { ...row, arrvVhId: '124', predictTravTm: '999', calcDate: '2024-01-01T00:00:00+09:00' }] });
    expect(html).toContain('산출 당시 예측 20분');
    expect(html).not.toContain('999분');
    expect(html).toContain('일부 정보는');
  });
  it('renders fixed service failure text without exposing provider error contents', () => {
    expect(view({ ...snapshot, httpStatus: 429 })).toContain('조회 한도에 도달해');
    expect(view({ ...snapshot, httpStatus: 503 })).toContain('연결 문제로');
    const html = view({ ...snapshot, resultCode: 'sensitive-error-text' });
    expect(html).toContain('정보 제공처의 응답을');
    expect(html).not.toContain('sensitive-error-text');
    expect(html).not.toContain('산출 당시 예측');
  });
});
