export interface MapIssue { host: string; scheme: string; kind: '보안 정책 차단' | '이미지 로드 실패' | '스크립트 로드 실패'; count: number }
/** Retain only bounded host-level information in component memory. No raw URL or query. */
export function recordMapIssue(previous: readonly MapIssue[], rawUrl: string, kind: MapIssue['kind']): MapIssue[] {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return [...previous]; }
  if (!['https:', 'http:'].includes(url.protocol) || url.hostname.length > 253 ||
    !/^[a-z0-9.-]+$/i.test(url.hostname)) return [...previous];
  const index = previous.findIndex(issue => issue.host === url.hostname && issue.scheme === url.protocol && issue.kind === kind);
  if (index >= 0) return previous.map((issue, i) => i === index ? { ...issue, count: Math.min(999, issue.count + 1) } : issue);
  if (previous.length >= 8) return [...previous];
  return [...previous, { host: url.hostname, scheme: url.protocol, kind, count: 1 }];
}
