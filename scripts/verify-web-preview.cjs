const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  for(const width of [390,1180]) {
   const page=await browser.newPage({viewport:{width,height:900}});const errors=[];const network=[];
   page.on('pageerror',()=>errors.push('pageerror'));
   page.on('request',r=>{if(/^https?:/.test(r.url()))network.push('network');});
   await page.setContent(fs.readFileSync('web-preview.html','utf8')); // Isolated HTML viewer; no Vite or asset server.
   await page.getByRole('heading',{name:'어디로 가시나요?',exact:true}).waitFor();
   const station=JSON.parse(fs.readFileSync('src/data/stations.json','utf8')).find(row=>row.id==='406000191');
   const picker=page.getByRole('region',{name:'출발지 지정',exact:true});
   await picker.getByLabel('정류장명',{exact:true}).fill(station.name);
   await picker.getByRole('list',{name:'출발지 정류장 검색 결과'}).getByRole('button',{name:`${station.name} · ID ${station.id}`,exact:true}).click();
   await page.getByRole('region',{name:'출발지 주변 정류장',exact:true}).getByRole('button').filter({hasText:'ID 406000191'}).click();
   assert.equal(await page.getByRole('button',{name:'화면 미리보기에서는 실시간 조회를 제공하지 않습니다',exact:true}).isDisabled(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
   if(width===1180)await page.screenshot({path:'/tmp/jeju-web-preview.png'});
   console.log(`Standalone HTML ${width}px: renders without server, stop search works, live requests disabled, no external assets/errors`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error('Standalone preview check failed:',String(error.message).slice(0,700));process.exitCode=1;});
