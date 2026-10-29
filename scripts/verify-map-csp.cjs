const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {classifyRequest}=require('./map-verification-guard.cjs');
// Policy integration test only: all provider resources are intercepted locally.
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage();let external=0,blockedBis=0;
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(classifyRequest(url.href)==='bis_blocked'){blockedBis++;return route.abort();}
   if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
   external++;
   assert.equal(url.protocol,'https:');
   if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:'window.__cspLoaded=(window.__cspLoaded||0)+1;'});
   return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8l8AAAAASUVORK5CYII=','base64')});
  });
  await page.goto('http://localhost:4173/');
  const bisBlocked=await page.evaluate(()=>fetch('/api/arrivals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stationId:'406000191'})}).then(()=>false,()=>true));
  assert.equal(bisBlocked,true);assert.equal(blockedBis,1);
  const result=await page.evaluate(async()=>{
   const violations=[];
   document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,host:new URL(e.blockedURI).hostname}));
   const script=src=>new Promise(resolve=>{const s=document.createElement('script');s.src=src;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.head.append(s);});
   const image=src=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(true);i.onerror=()=>resolve(false);i.src=src;document.body.append(i);});
   const loaded=await Promise.all([
    script('http://oapi.map.naver.com/csp-sample.js'),script('http://nrbe.map.naver.net/csp-sample.js'),script('http://nrbe.pstatic.net/csp-sample.js'),
    image('http://static.naver.net/csp-sample.png'),image('http://nrbe.map.naver.net/csp-sample.png')]);
   const denied=await script('https://unapproved.invalid/csp-sample.js');
   await new Promise(resolve=>setTimeout(resolve,50));
   return {loaded,denied,violations,count:window.__cspLoaded};
  });
  assert.deepEqual(result.loaded,[true,true,true,true,true]);assert.equal(result.count,3);assert.equal(result.denied,false);
  assert.equal(external,5);assert.deepEqual(result.violations,[{directive:'script-src-elem',host:'unapproved.invalid'}]);
  console.log('Map CSP mock: HTTP subresources upgraded; observed scripts/images allowed; unknown script blocked; BIS route blocked before proxy; actual provider requests 0.');
 }finally{await browser.close();}
})().catch(()=>{console.error('Map CSP mock failed; no resource URL or identifier logged.');process.exitCode=1;});
