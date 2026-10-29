const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  for(const sandboxed of [false,true]) for(const width of [390,1180]) {
   const page=await browser.newPage({viewport:{width,height:900}});const errors=[];const network=[];
   page.on('pageerror',()=>errors.push('pageerror'));
   page.on('request',r=>{if(/^https?:/.test(r.url()))network.push('network');});
   const html=fs.readFileSync('index.html','utf8');
   assert.equal(html,fs.readFileSync('web-preview.html','utf8'));
   assert.equal(html.includes('/src/main.tsx'),false);
   let surface=page;
   if(sandboxed) {
    await page.setContent('<iframe name="preview" sandbox="allow-scripts" style="width:100%;height:850px;border:0"></iframe>');
    await page.locator('iframe').evaluate((frame,content)=>{frame.srcdoc=content;},html);
    surface=page.frame({name:'preview'});
    assert.ok(surface);
   } else await page.setContent(html);
   await surface.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
   await surface.getByRole('heading',{name:'어디로 가시나요?',exact:true}).waitFor();
   const station=JSON.parse(fs.readFileSync('src/data/stations.json','utf8')).find(row=>row.id==='406000191');
   if(sandboxed && width===1180) await page.screenshot({path:'/workspace/jeju-smart-bus-codex-new/web-preview-screen.png'});
   const picker=surface.getByRole('region',{name:'출발지 지정',exact:true});
   await picker.getByLabel('정류장명',{exact:true}).fill(station.name);
   await picker.getByRole('list',{name:'출발지 정류장 검색 결과'}).getByRole('button',{name:`${station.name} · ID ${station.id}`,exact:true}).click();
   await surface.getByRole('region',{name:'출발지 주변 정류장',exact:true}).getByRole('button').filter({hasText:'ID 406000191'}).click();
   const beforeNavigation=surface.url();
   await picker.getByRole('button',{name:'도착정보 영역으로 이동',exact:true}).click();
   assert.equal(await surface.evaluate(()=>document.activeElement.id),'arrival-area');
   assert.equal(surface.url(),beforeNavigation);
   assert.equal(await surface.getByRole('button',{name:'화면 미리보기에서는 실시간 조회를 제공하지 않습니다',exact:true}).isDisabled(),true);
   assert.equal(await surface.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
   if(width===1180)await page.screenshot({path:'/tmp/jeju-web-preview.png'});
   console.log(`Standalone HTML ${sandboxed?'sandbox iframe':'document'} ${width}px: renders without server, stop search works, live requests disabled, no external assets/errors`);
   await page.close();
  }
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:1180,height:900}});
  const plain=await context.newPage();
  await plain.setContent(fs.readFileSync('index.html','utf8'));
  await plain.getByRole('heading',{name:'어디로 가시나요?',exact:true}).waitFor();
  assert.equal(await plain.getByRole('region',{name:'출발지 지정',exact:true}).isVisible(),true);
  assert.equal(await plain.getByText(/화면을 불러오는 중입니다/).count(),0);
  await plain.screenshot({path:'/workspace/jeju-smart-bus-codex-new/web-preview-screen-noscript.png'});
  console.log('Root Index without JavaScript: complete initial screen and input controls visible, no loading-only screen');
  await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error('Standalone preview check failed:',String(error.message).slice(0,700));process.exitCode=1;});
