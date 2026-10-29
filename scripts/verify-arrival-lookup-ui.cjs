const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
// Synthetic transport responses only. This script never contacts the BIS provider.
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  for(const width of [390,1280]) {
   const page=await browser.newPage({viewport:{width,height:900}});let calls=0;let mode='success';const bodies=[];
   await page.route('**/api/arrivals',async route=>{
    calls++;const request=route.request();bodies.push(request.postDataJSON());
    const stationId=request.postDataJSON().stationId;
    if(mode==='quota')return route.fulfill({status:429,contentType:'application/json',body:'{"error":"verification_budget"}'});
    const body={stationId,httpStatus:200,resultCode:'00',rows:[{routeId:'405000001',arrvVhId:'123',stationOrd:'24',updnDir:'0',predictTravTm:'8',leftStation:'4',calcDate:new Date().toISOString()}],mapping:[{routeId:'405000001',stationId,order:24,direction:'0'}]};
    return route.fulfill({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
   });
   await page.goto('http://127.0.0.1:4173/');
   const stop=JSON.parse(fs.readFileSync('src/data/stations.json','utf8')).find(row=>row.id==='406000191');
   const picker=page.getByRole('region',{name:'출발지 지정',exact:true});
   await picker.getByLabel('정류장명',{exact:true}).fill(stop.name);
   const choice=picker.getByRole('list',{name:'출발지 정류장 검색 결과'}).getByRole('button',{name:`${stop.name} · ID ${stop.id}`,exact:true});
   if(width===390) await choice.press('Enter'); else await choice.click();
   // Search selection must identify the arrival station without a second nearby-list click.
   await page.getByRole('region',{name:'정류장 도착정보',exact:true}).getByText(`선택 정류장: ${stop.name} · ID ${stop.id}`,{exact:true}).waitFor();
   assert.equal(await picker.getByRole('status').evaluate(el=>el===document.activeElement),true);
   assert.equal(calls,0);
   const panel=page.getByRole('region',{name:'정류장 도착정보',exact:true});
   await page.getByRole('button',{name:'선택 정류장 도착정보 조회',exact:true}).click();
   await panel.getByText('산출 당시 예측 8분',{exact:true}).waitFor();
   mode='quota';await page.getByRole('button',{name:'선택 정류장 도착정보 조회',exact:true}).click();
   await panel.getByText('조회 한도에 도달해 도착정보를 확인할 수 없습니다.',{exact:true}).waitFor();
   assert.equal(await panel.getByRole('list').count(),0);
   assert.deepEqual(bodies,[{stationId:stop.id},{stationId:stop.id}]);
   await picker.getByRole('button',{name:'위치 지우기'}).click();
   assert.equal(await page.getByRole('button',{name:'선택 정류장 도착정보 조회',exact:true}).count(),0);
   assert.equal(await panel.getByText(/선택 정류장:/).count(),0);
   console.log(`Arrival lookup ${width}px: explicit request, source display, quota clears prior data, selection reset passed`);
   await page.close();
  }
 } finally {await browser.close();}
})().catch(()=>{console.error('Arrival lookup UI check failed');process.exitCode=1;});
