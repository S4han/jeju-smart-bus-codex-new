const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const sdk=require('./fixtures/naver-sdk.cjs');
(async()=>{
 const origin='https://jeju-smart-bus-codex-new.vercel.app';
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.clock.install();let forbidden=0;
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='oapi.map.naver.com')return route.fulfill({contentType:'text/javascript',body:'window.__holdTiles=true;'+sdk+`;const BaseMap=window.naver.maps.Map;window.naver.maps.Map=class extends BaseMap{constructor(element,options){super(element,options);const image=new Image();image.src='https://tiles-unapproved.example/private-path?token=synthetic-private';element.append(image);}};`});
   if(url.origin!==origin||url.pathname.startsWith('/api/')){forbidden++;return route.abort();}
   const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(!/^(?:index\.html|assets\/[\w.-]+\.(?:js|css))$/.test(relative))return route.abort();
   return route.fulfill({contentType:relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(path.join('review-dist',relative))});
  });
  await page.goto(origin+'/');
  const stop=JSON.parse(fs.readFileSync('src/data/stations.json','utf8')).find(row=>row.id==='406000191');
  const picker=page.getByRole('region',{name:'출발지 지정',exact:true});
  await picker.getByLabel('정류장명',{exact:true}).fill(stop.name);
  await picker.getByRole('list').getByRole('button',{name:stop.name+' · ID '+stop.id,exact:true}).click();
  const panel=page.getByRole('region',{name:'출발지 주변 정류장',exact:true});
  await panel.getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true}).click();
  await panel.locator('.map-diagnostics').getByText(/tiles-unapproved\.example/).first().waitFor();
  await page.clock.fastForward(20_001);
  await panel.getByRole('status').filter({hasText:'지도를 확인하지 못했습니다.'}).waitFor();
  const diagnostic=await panel.locator('.map-diagnostics').innerText();
  assert.equal(diagnostic.includes('tiles-unapproved.example'),true);
  assert.equal(diagnostic.includes('private-path'),false);assert.equal(diagnostic.includes('synthetic-private'),false);
  assert.equal(await panel.locator('.map-diagnostics').getAttribute('open'),'');
  assert.equal(await panel.locator('.map-pin').count(),0);assert.equal(forbidden,0);
  console.log('Map diagnostic mock: blocked image host visible after timeout; no path/query retained; map removed; actual provider requests 0.');
 }finally{await browser.close();}
})().catch(()=>{console.error('Map diagnostic mock failed; no configured values or raw request URLs logged.');process.exitCode=1;});
