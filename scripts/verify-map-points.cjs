const {chromium}=require('playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
const sdk=require('./fixtures/naver-sdk.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:1000}});let sdkCalls=0,forbidden=0;
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='oapi.map.naver.com'){sdkCalls++;return route.fulfill({contentType:'text/javascript',body:sdk});}
    if(url.hostname!=='localhost'||url.pathname.startsWith('/api/')){forbidden++;return route.abort();}
    return route.continue();
   });
   await page.goto('http://localhost:4173/');
   const station=JSON.parse(fs.readFileSync('src/data/stations.json','utf8')).find(row=>row.id==='406000191');
   for(const [kind,label,pointName] of [['origin','출발지','선택한 출발 위치'],['destination','목적지','선택한 목적 위치']]){
    const picker=page.getByRole('region',{name:label+' 지정',exact:true});
    await picker.getByLabel('정류장명',{exact:true}).fill(station.name);
    await picker.getByRole('list',{name:label+' 정류장 검색 결과'}).getByRole('button',{name:station.name+' · ID '+station.id,exact:true}).click();
    const panel=page.getByRole('region',{name:label+' 주변 정류장',exact:true});
    assert.equal(await panel.locator('.map-location-pin').count(),0);
    await panel.getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true}).click();
    await panel.getByRole('img',{name:pointName,exact:true}).waitFor();
    assert.equal(await panel.locator('.map-location-'+kind).count(),1);
    const ids=await panel.locator('.map-pin').evaluateAll(nodes=>nodes.map(node=>node.dataset.stationId).sort());
    const listed=(await panel.getByRole('list').getByRole('button').allTextContents()).map(text=>text.match(/ID (\d{9})/)[1]).sort();
    assert.deepEqual(ids,listed);
    assert.equal(await panel.locator('.map-location-pin[data-station-id]').count(),0);
    assert.equal(await page.evaluate(kind=>{
     const marker=window.__markers.find(marker=>marker.options.icon.content.classList.contains('map-location-'+kind));
     return marker.options.position.lat===marker.options.map.options.center.lat&&marker.options.position.lng===marker.options.map.options.center.lng&&marker.options.zIndex===1;
    },kind),true);
   }
   assert.equal(sdkCalls,1);assert.equal(await page.evaluate(()=>window.__mapCreates),2);
   const destination=page.getByRole('region',{name:'목적지 주변 정류장',exact:true});
   await page.getByRole('region',{name:'출발지 지정',exact:true}).getByRole('button',{name:'위치 지우기',exact:true}).click();
   assert.equal(await page.locator('.map-location-origin').count(),0);
   assert.equal(await destination.locator('.map-location-destination').count(),1);
   assert.equal(await page.evaluate(()=>window.__mapDestroys),1);
   assert.equal(forbidden,0);await page.close();
   console.log('Map point labels '+width+'px: separate consent, correct origin/destination point, unchanged stop set, shared SDK, independent cleanup passed; provider requests 0.');
  }
 }finally{await browser.close();}
})().catch(()=>{console.error('Map point verification failed; no coordinates or identifiers logged.');process.exitCode=1;});
