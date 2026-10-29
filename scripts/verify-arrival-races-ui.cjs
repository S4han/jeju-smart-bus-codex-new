const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
// Deliberately ignores abort: late synthetic completions must still be discarded by the UI.
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  for(const width of [390,1280]) {
   const page=await browser.newPage({viewport:{width,height:900}});let external=0;
   page.on('request',r=>{if(!['127.0.0.1','localhost'].includes(new URL(r.url()).hostname))external++;});
   await page.addInitScript(()=>{
    const original=window.fetch;window.__pendingArrivals=[];
    window.fetch=(url,options)=>{
     if(url!=='/api/arrivals')return original(url,options);
     const {stationId}=JSON.parse(options.body);
     return new Promise(resolve=>window.__pendingArrivals.push({stationId,complete(minutes){
      const snapshot={stationId,httpStatus:200,resultCode:'00',rows:[{routeId:'405000001',arrvVhId:'123',stationOrd:'24',updnDir:'0',predictTravTm:String(minutes),leftStation:'4',calcDate:new Date().toISOString()}],mapping:[{routeId:'405000001',stationId,order:24,direction:'0'}]};
      resolve(new Response(JSON.stringify(snapshot),{status:200,headers:{'Content-Type':'application/json'}}));
     }}));
    };
   });
   await page.goto('http://127.0.0.1:4173/');
   const all=JSON.parse(fs.readFileSync('src/data/stations.json','utf8'));
   const a=all.find(row=>row.id==='406000191');const b=all.find(row=>row.id!==a.id&&row.name!==a.name);
   const picker=page.getByRole('region',{name:'출발지 지정',exact:true});
   const panel=page.getByRole('region',{name:'정류장 도착정보',exact:true});
   async function select(stop){
    await picker.getByLabel('정류장명',{exact:true}).fill(stop.name);
    await picker.getByRole('list',{name:'출발지 정류장 검색 결과'}).getByRole('button',{name:`${stop.name} · ID ${stop.id}`,exact:true}).click();
   }
   async function load(count){
    await page.getByRole('button',{name:'선택 정류장 도착정보 조회',exact:true}).click();
    await page.waitForFunction(n=>window.__pendingArrivals.length===n,count);
    assert.equal(await page.getByRole('button',{name:'도착정보 조회 중…',exact:true}).isDisabled(),true);
   }
   await select(a);await load(1);
   await page.getByRole('button',{name:'조회 취소',exact:true}).click();
   await page.getByRole('status').filter({hasText:'화면의 조회를 취소했습니다.'}).waitFor();
   await select(b);await load(2);
   await page.evaluate(()=>window.__pendingArrivals[1].complete(12));
   await panel.getByText('산출 당시 예측 12분',{exact:true}).waitFor();
   await page.evaluate(()=>window.__pendingArrivals[0].complete(8));
   assert.equal(await panel.getByText('산출 당시 예측 8분',{exact:true}).count(),0);
   await load(3);await select(a);await load(4);
   await page.evaluate(()=>window.__pendingArrivals[3].complete(4));
   await panel.getByText('산출 당시 예측 4분',{exact:true}).waitFor();
   await page.evaluate(()=>window.__pendingArrivals[2].complete(19));
   assert.equal(await panel.getByText('산출 당시 예측 19분',{exact:true}).count(),0);
   await panel.getByText(`선택 정류장: ${a.name} · ID ${a.id}`,{exact:true}).waitFor();
   await load(5);await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
   await page.evaluate(()=>window.__pendingArrivals[4].complete(7));
   await panel.getByText('아직 선택된 정류장이 없습니다. 주변 목록에서 정류장을 선택해 주세요.',{exact:true}).waitFor();
   assert.equal(await panel.getByRole('list').count(),0);assert.equal(external,0);
   console.log(`Arrival races ${width}px: cancellation, late completion, station switching, pagehide and no external calls passed`);
   await page.close();
  }
 } finally {await browser.close();}
})().catch(()=>{console.error('Arrival race UI verification failed');process.exitCode=1;});
