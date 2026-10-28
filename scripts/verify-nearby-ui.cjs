const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
(async () => {
 const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  for (const width of [390,1280]) {
   const context = await browser.newContext({viewport:{width,height:900}});
   const page = await context.newPage(); const external=[];
   page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/')) external.push('external');});
   await page.goto('http://127.0.0.1:4173/');
   const picker=page.getByRole('region',{name:'출발지 지정'});
   const origin=page.getByRole('region',{name:'출발지 주변 정류장',exact:true});
   const destination=page.getByRole('region',{name:'목적지 주변 정류장',exact:true});
   async function select(lat,lon) {
    await picker.getByLabel('위도',{exact:true}).fill(String(lat));
    await picker.getByLabel('경도',{exact:true}).fill(String(lon));
    await picker.getByRole('button',{name:'이 좌표를 출발지로 선택'}).click();
   }
   await select(0,0); // Synthetic position, not a user's location.
   await origin.getByRole('button',{name:'이 출발지에서 1km까지 확대'}).click();
   await origin.getByRole('status').filter({hasText:'1km 이내 정류장 0개'}).waitFor();
   assert.equal(await destination.getByRole('button').count(),0);
   const publicStop=JSON.parse(readFileSync('src/data/stations.json','utf8'))[0];
   await select(publicStop.latitude,publicStop.longitude);
   await origin.getByRole('status').filter({hasText:'500m 이내 정류장'}).waitFor();
   assert.equal(await origin.getByRole('button',{name:'이 출발지에서 1km까지 확대'}).count(),0);
   const stop=origin.getByRole('list').getByRole('button').first(); await stop.click();
   assert.equal(await stop.getAttribute('aria-pressed'),'true');
   const arrivals=page.getByRole('region',{name:'정류장 도착정보',exact:true});
   await arrivals.getByText(`선택 정류장: ${publicStop.name} · ID ${publicStop.id}`,{exact:true}).waitFor();
   assert.equal(await arrivals.getByRole('list').count(),0);
   await picker.getByRole('button',{name:'위치 지우기'}).click();
   await origin.getByText('출발지를 먼저 지정해 주세요.').waitFor();
   assert.equal(await page.getByRole('region',{name:'정류장 도착정보',exact:true}).getByText(/선택 정류장:/).count(),0);
   await select(0,0);
   await origin.getByRole('button',{name:'이 출발지에서 1km까지 확대'}).waitFor();
   assert.equal(await origin.getByText(/선택됨/).count(),0);
   await picker.getByLabel('정류장명',{exact:true}).fill(publicStop.name);
   await picker.getByRole('status').filter({hasText:'아직 출발지를 선택하지 않았습니다.'}).waitFor();
   await picker.getByRole('list',{name:'출발지 정류장 검색 결과'}).getByRole('button',{name:`${publicStop.name} · ID ${publicStop.id}`,exact:true}).click();
   await picker.getByText(`선택한 정류장: ${publicStop.name} · ID ${publicStop.id}`,{exact:true}).waitFor();
   const target=page.getByRole('region',{name:'목적지 지정',exact:true});
   await target.getByLabel('정류장명',{exact:true}).fill(publicStop.name);
   await target.getByRole('list',{name:'목적지 정류장 검색 결과'}).getByRole('button',{name:`${publicStop.name} · ID ${publicStop.id}`,exact:true}).click();
   await page.getByRole('status').filter({hasText:'출발지와 목적지를 지정했습니다.'}).waitFor();
   await target.getByLabel('정류장명',{exact:true}).fill('존재하지않는합성검색어');
   await target.getByRole('status').filter({hasText:'검색 결과 0개'}).waitFor();
   await destination.getByText('목적지를 먼저 지정해 주세요.').waitFor();
   await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
   assert.equal(await target.getByLabel('정류장명',{exact:true}).inputValue(),'');
   await origin.getByText('출발지를 먼저 지정해 주세요.').waitFor();
   assert.equal(await page.getByRole('region',{name:'정류장 도착정보',exact:true}).getByText(/선택 정류장:/).count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(external,[]);
   console.log(`Nearby UI ${width}px: default radius, explicit empty expansion, independent destination, reset and no external requests passed`);
   await context.close();
  }
 } finally { await browser.close(); }
})().catch(()=>{console.error('Nearby UI verification failed');process.exitCode=1;});
