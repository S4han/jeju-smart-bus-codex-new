const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
// Optional managed-environment Playwright check. No package/runtime dependency is added.
// Start npm run preview separately; all device locations below are synthetic.
(async () => {
  const browser = await chromium.launch({ ...(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), headless: true, args: ['--no-sandbox'] });
  try {
    for (const viewport of [{width:1280,height:1100},{width:390,height:844}]) {
      const context = await browser.newContext({viewport});
      await context.addInitScript(() => {
        window.__locationCalls = 0;
        Object.defineProperty(navigator, 'geolocation', {value: { getCurrentPosition(ok, fail) {
          window.__locationCalls++; window.__positionOk = ok; window.__positionFail = fail;
        }}});
      });
      const page = await context.newPage(); const requests = []; const errors = []; const consoleText = [];
      page.on('console', m => consoleText.push(m.text()));
      page.on('request', r => requests.push({url:r.url(),body:r.postData()}));
      page.on('pageerror', () => errors.push('pageerror'));
      const response = await page.goto('http://127.0.0.1:4173/');
      assert.equal(response.status(),200); assert.equal(response.headers()['cache-control'],'no-store');
      assert.equal(await page.evaluate(() => window.__locationCalls),0);
      assert.equal(await page.getByRole('button',{name:'버스 경로 찾기'}).isDisabled(),true);
      await page.getByRole('button',{name:'현재 위치 사용',exact:true}).click();
      assert.equal(await page.evaluate(() => window.__locationCalls),1);
      await page.evaluate(() => window.__positionFail({code:1,message:'not to be displayed'}));
      await page.getByRole('status').filter({hasText:'위치 권한이 허용되지 않았습니다.'}).waitFor();
      await page.getByLabel('위도',{exact:true}).fill('33.123456');
      await page.getByLabel('경도',{exact:true}).fill('126.654321');
      await page.getByRole('button',{name:'이 좌표를 출발지로 선택'}).click();
      await page.getByRole('status').filter({hasText:'입력한 좌표를 출발지로 선택했습니다.'}).waitFor();
      assert.equal(await page.getByLabel('위도',{exact:true}).inputValue(),'');
      await page.getByLabel('위도',{exact:true}).fill('bad');
      await page.getByRole('status').filter({hasText:'아직 출발지를 선택하지 않았습니다.'}).waitFor();
      await page.getByRole('button',{name:'이 좌표를 출발지로 선택'}).click();
      await page.getByRole('status').filter({hasText:'위도는 -90~90'}).waitFor();
      await page.getByRole('button',{name:'현재 위치 사용',exact:true}).click();
      await page.getByRole('button',{name:'위치 지우기'}).click();
      await page.evaluate(() => window.__positionOk({coords:{latitude:33.123456,longitude:126.654321}}));
      await page.getByRole('status').filter({hasText:'아직 출발지를 선택하지 않았습니다.'}).waitFor();
      await page.getByRole('button',{name:'현재 위치 사용',exact:true}).click();
      await page.evaluate(() => window.__positionOk({coords:{latitude:33.123456,longitude:126.654321}}));
      await page.getByRole('status').filter({hasText:'현재 위치를 출발지로 선택했습니다.'}).waitFor();
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await page.getByRole('status').filter({hasText:'아직 출발지를 선택하지 않았습니다.'}).waitFor();
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length),0);
      assert.equal((await context.cookies()).length,0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
      assert.equal(page.url(),'http://127.0.0.1:4173/');
      assert.equal(requests.every(r => r.url.startsWith('http://127.0.0.1:4173/') && !r.body && !r.url.includes('33.123456') && !r.url.includes('126.654321')),true);
      assert.deepEqual(errors,[]);
      assert.equal(consoleText.some(t => t.includes('33.123456') || t.includes('126.654321') || t.includes('not to be displayed')),false);
      await page.reload();
      await page.getByRole('status').filter({hasText:'아직 출발지를 선택하지 않았습니다.'}).waitFor();
      assert.equal(await page.evaluate(() => window.__locationCalls),0);
      await page.screenshot({path:`/tmp/task004-local-${viewport.width}.png`,fullPage:true});
      console.log(`Local UI ${viewport.width}px: pass (mock location, no external requests, no stored location)`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(() => { console.error('Local UI verification failed; review script without logging location details.'); process.exitCode=1; });
