const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const sdk=require('./fixtures/naver-sdk.cjs');
(async()=>{
 const origin='https://jeju-smart-bus-codex-new.vercel.app';
 const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 const responseHeaders=Object.fromEntries(config.headers[0].headers.map(({key,value})=>[key,value]));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 let entryReferrer=null,followupReferrer=null,forbidden=0;
 try{
  const page=await browser.newPage();
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(['oapi.map.naver.com','nrbe.pstatic.net'].includes(url.hostname)){
    const referer=(await route.request().allHeaders()).referer||null;
    if(url.pathname==='/openapi/v3/maps.js'){
     entryReferrer=referer;
     return route.fulfill({contentType:'text/javascript',body:sdk+';const proof=document.createElement("script");proof.src="https://nrbe.pstatic.net/followup-proof.js";document.head.append(proof);'});
    }
    followupReferrer=referer;
    return route.fulfill({contentType:'text/javascript',body:'window.__authChecked=true;'});
   }
   if(url.origin!==origin||url.pathname.startsWith('/api/')){forbidden++;return route.abort();}
   const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(!/^(?:index\.html|assets\/[\w.-]+\.(?:js|css))$/.test(relative))return route.abort();
   return route.fulfill({headers:responseHeaders,contentType:relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(path.join('review-dist',relative))});
  });
  await page.goto(origin+'/?review-check=synthetic');
  const stop=JSON.parse(fs.readFileSync('src/data/stations.json','utf8')).find(row=>row.id==='406000191');
  const picker=page.getByRole('region',{name:'출발지 지정',exact:true});
  await picker.getByLabel('정류장명',{exact:true}).fill(stop.name);
  await picker.getByRole('list').getByRole('button',{name:stop.name+' · ID '+stop.id,exact:true}).click();
  assert.equal(entryReferrer,null);assert.equal(followupReferrer,null);
  await page.getByRole('region',{name:'출발지 주변 정류장',exact:true}).getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true}).click();
  await page.waitForFunction(()=>window.__authChecked===true);
  console.log(JSON.stringify({entryHasOriginOnly:entryReferrer===origin+'/',followupHasOriginOnly:followupReferrer===origin+'/',forbiddenRequests:forbidden,actualProviderRequests:0}));
  assert.equal(entryReferrer,origin+'/');assert.equal(followupReferrer,origin+'/');assert.equal(forbidden,0);
 }finally{await browser.close();}
})().catch(()=>{console.error('Map origin-only referrer regression failed; no identifier, coordinates or raw URL logged.');process.exitCode=1;});
