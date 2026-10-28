const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
// Requires the environment-provided Playwright and a local Vite dev server on port 5173.
// Only synthetic rows are used; the application has no test-data injection entry.
(async () => {
  const browser = await chromium.launch({ ...(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage(); const requests = []; const errors = [];
      page.on('request', request => requests.push(request.url()));
      page.on('pageerror', () => errors.push('pageerror'));
      await page.clock.install({ time: new Date('2026-10-28T21:41:00+09:00') });
      await page.goto('http://127.0.0.1:5173/tests/fixtures/arrival-panel.html');
      await page.getByText('산출 당시 예측 20분', { exact: true }).waitFor();
      await page.clock.pauseAt(new Date('2026-10-28T21:41:28+09:00'));
      assert.equal(await page.evaluate(() => Date.now()), Date.parse('2026-10-28T21:41:28+09:00'), 'test clock must be paused at exact initial time');
      await page.clock.runFor(21_000);
      assert.equal(await page.evaluate(() => Date.now()), Date.parse('2026-10-28T21:41:49+09:00'), 'test clock must be at the exact 60-second boundary');
      assert.equal(await page.getByText('산출 당시 예측 20분', { exact: true }).count(), 1, 'prediction must remain at 60 seconds');
      await page.clock.fastForward(1);
      await page.getByRole('status').filter({ hasText: '실시간 정보 미확인' }).waitFor();
      assert.equal(await page.getByLabel('검증된 도착 예측').count(), 0);

      await page.clock.setSystemTime(new Date('2026-10-28T21:41:28+09:00'));
      await page.reload();
      await page.getByText('산출 당시 예측 20분', { exact: true }).waitFor();
      await page.clock.setSystemTime(new Date('2026-10-28T21:42:00+09:00'));
      await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
      await page.getByRole('status').filter({ hasText: '실시간 정보 미확인' }).waitFor();

      await page.clock.setSystemTime(new Date('2026-10-28T21:41:28+09:00'));
      await page.reload();
      await page.getByText('산출 당시 예측 20분', { exact: true }).waitFor();
      for (const [mode, text] of [
        ['wrong', '선택한 정류장의 도착정보가 확인되지 않았습니다.'],
        ['loading', '선택한 정류장의 도착정보를 확인하고 있습니다.'],
        ['empty', '제공된 도착정보가 없습니다.'],
        ['quota', '조회 한도에 도달해'],
        ['network', '연결 문제로'],
        ['unverified', '실시간 정보 미확인'],
        ['none', '아직 선택된 정류장이 없습니다.'],
      ]) {
        await page.evaluate(mode => window.arrivalPanelTest.mode(mode), mode);
        await page.getByRole('status').filter({ hasText: text }).waitFor();
        assert.equal(await page.getByLabel('검증된 도착 예측').count(), 0);
      }
      await page.evaluate(() => window.arrivalPanelTest.mode('mixed'));
      await page.getByText('산출 당시 예측 20분', { exact: true }).waitFor();
      assert.equal(await page.getByText('산출 당시 예측 999분', { exact: true }).count(), 0);
      await page.getByText('일부 정보는', { exact: false }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `/tmp/task004-arrival-${width}.png`, fullPage: true });
      await page.evaluate(() => window.arrivalPanelTest.unmount());
      await page.clock.fastForward(120_000);
      assert.deepEqual(errors, []);
      assert.equal(requests.every(url => url.startsWith('http://127.0.0.1:5173/')), true);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      console.log(`Arrival UI ${width}px: expiry, resume, station change and safe states passed; no provider requests.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error('Arrival UI verification failed:', error.name, error.message); process.exitCode = 1; });
