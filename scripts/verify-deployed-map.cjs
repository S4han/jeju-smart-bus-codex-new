const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const sdk=require('./fixtures/naver-sdk.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(const origin of ['https://jeju-smart-bus-codex-new.vercel.app','https://unapproved.example']){
   const page=await browser.newPage({viewport:{width:390,height:1000}});let sdkCalls=0,forbidden=0;
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='oapi.map.naver.com'){sdkCalls++;return route.fulfill({contentType:'text/javascript',body:sdk});}
    if(url.origin!==origin||url.pathname.startsWith('/api/')){forbidden++;return route.abort();}
    const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(!/^(?:index\.html|assets\/[\w.-]+\.(?:js|css))$/.test(relative))return route.abort();
    const file=path.join('review-dist',relative);
    return route.fulfill({contentType:relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});
   });
   await page.goto(origin+'/');
   const stop=JSON.parse(fs.readFileSync('src/data/stations.json','utf8')).find(row=>row.id==='406000191');
   const picker=page.getByRole('region',{name:'출발지 지정',exact:true});
   await picker.getByLabel('정류장명',{exact:true}).fill(stop.name);
   await picker.getByRole('list',{name:'출발지 정류장 검색 결과'}).getByRole('button',{name:stop.name+' · ID '+stop.id,exact:true}).click();
   assert.equal(sdkCalls,0);
   assert.equal(await page.getByRole('button',{name:'조회 예산 소진으로 실시간 조회가 중단되었습니다',exact:true}).isDisabled(),true);
   const panel=page.getByRole('region',{name:'출발지 주변 정류장',exact:true});
   const consent=panel.getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true});
   if(origin==='https://jeju-smart-bus-codex-new.vercel.app'){
    await panel.getByRole('button',{name:'지도 없이 이용',exact:true}).click();assert.equal(sdkCalls,0);
    await consent.click();await panel.locator('.map-pin').first().waitFor();
    const ids=await panel.locator('.map-pin').evaluateAll(nodes=>nodes.map(node=>node.dataset.stationId).sort());
    const listed=(await panel.getByRole('list').getByRole('button').allTextContents()).map(text=>text.match(/ID (\d{9})/)[1]).sort();
    assert.deepEqual(ids,listed);assert.equal(sdkCalls,1);
   }else{assert.equal(await consent.count(),0);assert.equal(sdkCalls,0);}
   assert.equal(forbidden,0);await page.close();
  }
  console.log('Hosted map build mock: exact approved HTTPS domain only; consent/decline boundary; identical stops; BIS disabled; actual provider requests 0.');
 }finally{await browser.close();}
})().catch(()=>{console.error('Hosted map build verification failed; no configured values or request URLs logged.');process.exitCode=1;});
