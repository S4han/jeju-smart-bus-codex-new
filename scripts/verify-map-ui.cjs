const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
// SDK stand-in only. Every external request is intercepted; no NAVER allowance is used.
const sdk=`
window.__mapCreates=0;window.__mapDestroys=0;window.__maps=[];
window.naver={maps:{
 LatLng:class {constructor(lat,lng){this.lat=lat;this.lng=lng;}},
 Map:class {constructor(element,options){this.element=element;this.options=options;window.__mapCreates++;window.__maps.push(this);} destroy(){window.__mapDestroys++;this.element.replaceChildren();} autoResize(){} fitBounds(){}},
 Marker:class {constructor(options){this.options=options;options.map.element.append(options.icon.content);} setMap(map){if(!map)this.options.icon.content.remove();} setIcon(icon){this.options.icon.content.replaceWith(icon.content);this.options.icon=icon;}},
 Event:{addListener(target,name,callback){if(name==='tilesloaded'){const listener={callback,active:true};target.tileListener=listener;if(!window.__holdTiles)queueMicrotask(()=>{if(listener.active)callback();});return listener;}target.options.icon.content.onclick=callback;return target;} ,removeListener(target){if('active' in target){target.active=false;return;}target.options.icon.content.onclick=null;}}
}};`;
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  for(const width of [390,1280]) {
   const page=await browser.newPage({viewport:{width,height:1000}});let sdkCalls=0;let unexpected=0;let apiCalls=0;
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='oapi.map.naver.com'){sdkCalls++;return route.fulfill({contentType:'text/javascript',body:sdk});}
    if(!['localhost','127.0.0.1'].includes(url.hostname)){unexpected++;return route.abort();}
    if(url.pathname==='/api/arrivals'){apiCalls++;return route.abort();}
    return route.continue();
   });
   await page.goto('http://localhost:4173/');
   const station=JSON.parse(fs.readFileSync('src/data/stations.json','utf8')).find(row=>row.id==='406000191');
   const picker=page.getByRole('region',{name:'출발지 지정',exact:true});
   await picker.getByLabel('정류장명',{exact:true}).fill(station.name);
   await picker.getByRole('list',{name:'출발지 정류장 검색 결과'}).getByRole('button',{name:`${station.name} · ID ${station.id}`,exact:true}).click();
   const panel=page.getByRole('region',{name:'출발지 주변 정류장',exact:true});
   assert.equal(sdkCalls,0);
   await panel.getByRole('button',{name:'지도 없이 이용',exact:true}).click();
   assert.equal(sdkCalls,0);
   await panel.getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true}).click();
   await panel.locator('.map-pin').first().waitFor();
   assert.equal(await panel.getByRole('status').filter({hasText:'지도를 불러오는 중입니다.'}).count(),0);
   const listed=await panel.getByRole('list',{name:'출발지 주변 정류장 목록'}).getByRole('button').allTextContents();
   const listIds=listed.map(text=>text.match(/ID (\d{9})/)[1]).sort();
   const mapIds=await panel.locator('.map-pin').evaluateAll(nodes=>nodes.map(node=>node.dataset.stationId).sort());
   assert.deepEqual(mapIds,listIds);assert.equal(sdkCalls,1);
   const other=mapIds.find(id=>id!==station.id);
   await panel.locator('.map-pin[data-station-id="'+other+'"]').click();
   assert.equal(await panel.getByRole('list').getByRole('button').filter({hasText:'ID '+other}).getAttribute('aria-pressed'),'true');
   await panel.getByRole('list').getByRole('button').filter({hasText:'ID '+station.id}).click();
   assert.equal(await panel.locator('.map-pin-selected').getAttribute('data-station-id'),station.id);
   assert.equal(await page.evaluate(()=>window.__mapCreates),1);
   await picker.getByRole('button',{name:'위치 지우기'}).click();
   assert.equal(await page.evaluate(()=>window.__mapDestroys),1);
   assert.equal(await panel.locator('.map-pin').count(),0);
   await picker.getByLabel('정류장명',{exact:true}).fill(station.name);
   await picker.getByRole('list',{name:'출발지 정류장 검색 결과'}).getByRole('button',{name:`${station.name} · ID ${station.id}`,exact:true}).click();
   await panel.getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true}).click();
   await panel.locator('.map-pin').first().waitFor();
   await panel.getByRole('button',{name:'지도 동의 철회 및 위치 지우기',exact:true}).click();
   await picker.getByRole('status').filter({hasText:'아직 출발지를 선택하지 않았습니다.'}).waitFor();
   assert.equal(await page.locator('script[src*="oapi.map.naver.com"]').count(),0);
   assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
   assert.equal(sdkCalls,1);assert.equal(apiCalls,0);assert.equal(unexpected,0);
   console.log(`Map SDK stand-in ${width}px: no request before consent/after decline, identical list and markers, bidirectional selection, cleanup passed`);
   await page.close();
  }
  const failedPage=await browser.newPage();let failedCalls=0;
  await failedPage.route('https://oapi.map.naver.com/**',async route=>{failedCalls++;await route.fulfill({contentType:'text/javascript',body:'window.navermap_authFailure();'});});
  await failedPage.goto('http://localhost:4173/');
  const sample=JSON.parse(fs.readFileSync('src/data/stations.json','utf8')).find(row=>row.id==='406000191');
  const origin=failedPage.getByRole('region',{name:'출발지 지정',exact:true});
  await origin.getByLabel('정류장명',{exact:true}).fill(sample.name);
  await origin.getByRole('list').getByRole('button',{name:`${sample.name} · ID ${sample.id}`,exact:true}).click();
  const region=failedPage.getByRole('region',{name:'출발지 주변 정류장',exact:true});
  await region.getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true}).click();
  await region.getByRole('status').filter({hasText:'지도를 확인하지 못했습니다.'}).waitFor();
  assert.equal(await region.getByRole('list').getByRole('button').count()>0,true);
  assert.equal(failedCalls,1);
  console.log('Map SDK stand-in failure: normalized error, list remains usable, no automatic retry passed');
  await failedPage.close();
  const latePage=await browser.newPage();let lateCalls=0;
  await latePage.route('https://oapi.map.naver.com/**',async route=>{lateCalls++;await route.fulfill({contentType:'text/javascript',body:sdk});});
  await latePage.goto('http://localhost:4173/');
  const latePicker=latePage.getByRole('region',{name:'출발지 지정',exact:true});
  const latePanel=latePage.getByRole('region',{name:'출발지 주변 정류장',exact:true});
  async function selectAgain() {
   await latePicker.getByLabel('정류장명',{exact:true}).fill(sample.name);
   await latePicker.getByRole('list').getByRole('button',{name:`${sample.name} · ID ${sample.id}`,exact:true}).click();
   await latePanel.getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true}).click();
  }
  await selectAgain();await latePanel.locator('.map-pin').first().waitFor();
  await latePage.evaluate(()=>window.navermap_authFailure());
  await latePanel.getByRole('status').filter({hasText:'지도를 확인하지 못했습니다.'}).waitFor();
  await latePicker.getByRole('button',{name:'위치 지우기'}).click();
  await selectAgain();
  await latePanel.getByRole('status').filter({hasText:'지도를 확인하지 못했습니다.'}).waitFor();
  assert.equal(lateCalls,1);assert.equal(await latePage.evaluate(()=>window.__mapCreates),1);
  console.log('Map late authentication failure: destroys map and prevents another construction without retry passed');
  const tilePage=await browser.newPage();let tileCalls=0;
  await tilePage.clock.install();
  await tilePage.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='oapi.map.naver.com'){tileCalls++;return route.fulfill({contentType:'text/javascript',body:'window.__holdTiles=true;'+sdk});}
   if(url.hostname!=='localhost'||url.pathname.startsWith('/api/'))return route.abort();
   return route.continue();
  });
  await tilePage.goto('http://localhost:4173/');
  const tilePicker=tilePage.getByRole('region',{name:'출발지 지정',exact:true});
  const tilePanel=tilePage.getByRole('region',{name:'출발지 주변 정류장',exact:true});
  const selectTileStop=async()=>{
   await tilePicker.getByLabel('정류장명',{exact:true}).fill(sample.name);
   await tilePicker.getByRole('list').getByRole('button',{name:`${sample.name} · ID ${sample.id}`,exact:true}).click();
   await tilePanel.getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true}).click();
  };
  await selectTileStop();await tilePanel.locator('.map-pin').first().waitFor();
  await tilePanel.getByRole('status').filter({hasText:'지도를 불러오는 중입니다.'}).waitFor();
  await tilePage.clock.fastForward(20_001);
  await tilePanel.getByRole('status').filter({hasText:'지도를 확인하지 못했습니다.'}).waitFor();
  assert.equal(await tilePage.evaluate(()=>window.__mapDestroys),1);
  await tilePage.evaluate(()=>window.__maps[0].tileListener.callback());
  await tilePanel.getByRole('status').filter({hasText:'지도를 확인하지 못했습니다.'}).waitFor();
  assert.equal(await tilePanel.locator('.map-pin').count(),0);
  assert.equal(await tilePanel.getByRole('list').getByRole('button').count()>0,true);
  await tilePicker.getByRole('button',{name:'위치 지우기'}).click();
  await selectTileStop();
  await tilePanel.getByRole('status').filter({hasText:'지도를 확인하지 못했습니다.'}).waitFor();
  assert.equal(tileCalls,1);assert.equal(await tilePage.evaluate(()=>window.__mapCreates),1);
  await tilePage.close();
  console.log('Map tile timeout: loading remains until tiles, destroys blank map, list preserved, no second SDK/map creation passed');
  await latePage.close();
  for(const mode of ['location-clear','pagehide','tiles-complete']){
   const boundary=await browser.newPage();await boundary.clock.install();let calls=0;
   await boundary.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='oapi.map.naver.com'){calls++;return route.fulfill({contentType:'text/javascript',body:'window.__holdTiles=true;'+sdk});}
    if(url.hostname!=='localhost'||url.pathname.startsWith('/api/'))return route.abort();
    return route.continue();
   });
   await boundary.goto('http://localhost:4173/');
   const picker=boundary.getByRole('region',{name:'출발지 지정',exact:true});
   const panel=boundary.getByRole('region',{name:'출발지 주변 정류장',exact:true});
   const select=async()=>{
    await picker.getByLabel('정류장명',{exact:true}).fill(sample.name);
    await picker.getByRole('list').getByRole('button',{name:`${sample.name} · ID ${sample.id}`,exact:true}).click();
    await panel.getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true}).click();
    await panel.locator('.map-pin').first().waitFor();
   };
   await select();
   if(mode==='location-clear')await picker.getByRole('button',{name:'위치 지우기'}).click();
   if(mode==='pagehide')await boundary.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
   if(mode==='tiles-complete')await boundary.evaluate(()=>window.__maps[0].tileListener.callback());
   await boundary.clock.fastForward(20_001);
   assert.equal(await panel.getByRole('status').filter({hasText:'지도를 확인하지 못했습니다.'}).count(),0);
   assert.equal(await boundary.evaluate(()=>window.__mapDestroys),mode==='tiles-complete'?0:1);
   if(mode!=='tiles-complete'){
    assert.equal(await boundary.evaluate(()=>window.__maps[0].tileListener.active),false);
    await boundary.evaluate(()=>window.__maps[0].tileListener.callback());
   }
   if(mode==='location-clear'){
    await select();assert.equal(await boundary.evaluate(()=>window.__mapCreates),2);
   }
   assert.equal(calls,1);await boundary.close();
   console.log('Map lifecycle '+mode+': pending timer cleared, stale event harmless, no SDK reload passed');
  }
 } finally {await browser.close();}
})().catch(()=>{console.error('Map UI stand-in verification failed; no provider URL or identifier is logged.');process.exitCode=1;});
