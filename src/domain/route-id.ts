/** U-003: user-approved identity only, not route feasibility or a routing engine. */
export interface RouteLegIdentity {
  readonly routeId: string;
  readonly direction: string;
  readonly boardOrder: number;
  readonly alightOrder: number;
}
function encodeOrder(order: number): string {
  if (!Number.isSafeInteger(order) || order < 1) throw new Error('Invalid stop order');
  return String(order).padStart(16, '0');
}
/** No user coordinates, names, predicted times or time-dependent data enter this ID. */
export function createRouteId(legs: readonly RouteLegIdentity[]): string {
  if (legs.length < 1 || legs.length > 3) throw new Error('Expected one to three bus legs');
  const segments = legs.map(leg => {
    if (!/^\d{9}$/.test(leg.routeId) || !/^(0|[1-9]\d*)$/.test(leg.direction))
      throw new Error('Invalid route identity');
    const board = encodeOrder(leg.boardOrder), alight = encodeOrder(leg.alightOrder);
    if (leg.alightOrder <= leg.boardOrder) throw new Error('Stop orders must increase');
    return `${leg.routeId}:${leg.direction}:${board}:${alight}`;
  });
  return `route:v1|${segments.join('|')}`;
}
/** Locale-independent code-unit comparison for the final PRD tie-break only. */
export function compareRouteIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
