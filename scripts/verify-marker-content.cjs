const {chromium}=require('playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const {transformWithOxc}=await import('vite');
 const module=await transformWithOxc(fs.readFileSync('src/map/markerContent.ts','utf8'),'src/map/markerContent.ts');
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();let external=0;
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='localhost'){external++;return route.abort();}
   if(url.pathname==='/__marker-content-test.js')return route.fulfill({contentType:'text/javascript',body:module.code});
   if(url.pathname.startsWith('/api/'))return route.abort();
   return route.continue();
  });
  await page.goto('http://localhost:4173/');
  const result=await page.evaluate(async()=>{
   const {createStationPin,updateStationPin}=await import('/__marker-content-test.js');
   const name='<img src=x onerror="window.__injected=true"> & 합성 정류장';
   const pin=createStationPin('000000001',name);document.body.append(pin);
   const safe=pin.querySelectorAll('img,script').length===0&&pin.querySelector('.map-pin-label').textContent===name;
   const button=pin.tagName==='BUTTON'&&pin.type==='button'&&pin.getAttribute('aria-label')===name+' · ID 000000001';
   const initial=pin.getAttribute('aria-pressed')==='false';
   updateStationPin(pin,true);
   const selected=pin.getAttribute('aria-pressed')==='true'&&pin.querySelector('.map-pin-symbol').textContent==='✓';
   const size=pin.getBoundingClientRect();
   const labelVisible=getComputedStyle(pin.querySelector('.map-pin-label')).display!=='none';
   updateStationPin(pin,false);
   return {safe,button,initial,selected,labelVisible,width:size.width,height:size.height,unselected:pin.getAttribute('aria-pressed')==='false'};
  });
  assert.deepEqual(result,{safe:true,button:true,initial:true,selected:true,labelVisible:true,width:44,height:44,unselected:true});
  assert.equal(external,0);
  console.log('Marker DOM: untrusted names remain text; accessible button/pressed state; 44px target; selected label visible; provider requests 0.');
 }finally{await browser.close();}
})().catch(()=>{console.error('Marker DOM verification failed; no identifiers or provider URLs logged.');process.exitCode=1;});
