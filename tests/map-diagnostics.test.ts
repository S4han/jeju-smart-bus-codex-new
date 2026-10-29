import { expect, it } from 'vitest';
import { recordMapIssue } from '../src/map/diagnostics';
it('retains scheme and host only, removing credentials, path, query, and fragment', () => {
 const rows=recordMapIssue([], 'https://synthetic:private@tiles.example/path/private?token=private#secret', '이미지 로드 실패');
 expect(rows).toEqual([{host:'tiles.example',scheme:'https:',kind:'이미지 로드 실패',count:1}]);
 expect(JSON.stringify(rows)).not.toContain('private');
});
it('aggregates repeated failures with bounded counters and host entries', () => {
 let rows=recordMapIssue([], 'https://tiles.example/a', '보안 정책 차단');
 rows=recordMapIssue(rows,'https://tiles.example/b','보안 정책 차단');expect(rows[0]!.count).toBe(2);
 for(let i=0;i<12;i++)rows=recordMapIssue(rows,`https://tiles${i}.example/a`,'이미지 로드 실패');
 expect(rows).toHaveLength(8);
 const capped=recordMapIssue([{...rows[0]!,count:999}], 'https://tiles.example/','보안 정책 차단');expect(capped[0]!.count).toBe(999);
});
it('ignores invalid, inline, and non-HTTP resource values', () => {
 for(const value of ['inline','not a url','data:image/png;base64,synthetic','file:///private'])expect(recordMapIssue([],value,'스크립트 로드 실패')).toEqual([]);
});
