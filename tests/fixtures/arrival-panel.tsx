import { createRoot } from 'react-dom/client';
import { ArrivalPanel, type ArrivalSnapshot } from '../../src/ArrivalPanel';
import '../../src/style.css';

// Local browser-test entry only. Never imported by the application or production build.
const stationId = '406000001';
const row = { routeId: '405000001', stationOrd: '24', updnDir: '0', arrvVhId: '123',
  predictTravTm: '20', leftStation: '17', calcDate: '2026-10-28T21:40:49+09:00' };
const sample: ArrivalSnapshot = { stationId, httpStatus: 200, resultCode: '00', rows: [row],
  mapping: [{ routeId: row.routeId, stationId, order: 24, direction: '0' }] };
const root = createRoot(document.getElementById('root')!);
function mode(name: string) {
  let snapshot = sample;
  if (name === 'empty') snapshot = { ...sample, rows: [] };
  if (name === 'quota') snapshot = { ...sample, httpStatus: 429 };
  if (name === 'network') snapshot = { ...sample, httpStatus: 503 };
  if (name === 'unverified') snapshot = { ...sample, mapping: [] };
  if (name === 'mixed') snapshot = { ...sample, rows: [row, { ...row, arrvVhId: '124', calcDate: '2024-01-01T00:00:00Z', predictTravTm: '999' }] };
  root.render(<ArrivalPanel selectedStationId={name === 'wrong' ? '406000002' : name === 'none' ? null : stationId}
    snapshot={snapshot} loading={name === 'loading'} />);
}
(window as Window & { arrivalPanelTest?: { mode: typeof mode; unmount: () => void } }).arrivalPanelTest = {
  mode, unmount: () => root.unmount(),
};
mode('fresh');
